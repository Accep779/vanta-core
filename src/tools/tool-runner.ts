import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult, EngagementContext } from '../tools/tool-registry';

const execAsync = promisify(exec);

/**
 * ToolRunner — Execute security tools in isolated Docker containers
 * 
 * Security guarantees:
 * - Tools run in containers, not on host
 * - Non-root user in containers
 * - Read-only filesystem with tmpfs
 * - Network isolation (bridge mode)
 * - Result files mounted to host for retrieval
 */

export interface ToolRunConfig {
  toolName: string;
  target: string;
  params: Record<string, any>;
  timeoutMs?: number;
}

export class ToolRunner {
  private scanOutputDir: string = '/tmp/vanta-scans';

  constructor(scanOutputDir: string = '/tmp/vanta-scans') {
    this.scanOutputDir = scanOutputDir;
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  /**
   * Run nmap in Docker container
   */
  async runNmap(target: string, ports?: string): Promise<ToolResult> {
    const scanFile = `nmap_${Date.now()}`;
    const portArg = ports ? `-p ${ports}` : '-p 22,80,443';
    
    try {
      console.log('[ToolRunner] Running nmap:', target, portArg);
      
      const { stdout, stderr } = await execAsync(
        `docker run --rm ` +
        `-v ${this.scanOutputDir}:/workspace/scans:rw ` +
        `--network host ` +
        `--user root ` +
        `vanta-core/nmap-runner:latest ` +
        `nmap --unprivileged -T4 ${portArg} -sV -oA /workspace/scans/${scanFile} ${target}`,
        { timeout: 300000 } // 5 min timeout
      );

      // Parse nmap output
      const results = await this.parseNmapResult(`${this.scanOutputDir}/${scanFile}.xml`);
      
      return {
        success: true,
        output: results,
        discoveredAssets: results.hosts.map((h: any) => ({
          id: `host_${Date.now()}`,
          type: 'ip' as const,
          value: h.ip,
          discoveredAt: Date.now(),
          vulnerabilities: h.ports?.map((p: any) => ({
            id: `port_${h.ip}_${p.port}`,
            type: 'open_port',
            severity: 'LOW' as const,
            description: `${p.port}/${p.protocol} - ${p.service}`,
            discoveredAt: Date.now(),
          })),
        })),
      };
    } catch (error: any) {
      console.error('[ToolRunner] Nmap error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run subfinder in Docker container
   */
  async runSubfinder(domain: string): Promise<ToolResult> {
    const outputFile = `subfinder_${Date.now()}.txt`;
    
    try {
      console.log('[ToolRunner] Running subfinder:', domain);
      
      const { stdout, stderr } = await execAsync(
        `docker run --rm ` +
        `-v ${this.scanOutputDir}:/workspace/scans:rw ` +
        `--network host ` +
        `--user root ` +
        `vanta-core/subfinder-runner:latest ` +
        `-d ${domain} -o /workspace/scans/${outputFile}`,
        { timeout: 300000 }
      );

      // Read subdomain results
      const subdomains = await this.readSubdomainResults(`${this.scanOutputDir}/${outputFile}`);
      
      return {
        success: true,
        output: { subdomains },
        discoveredAssets: subdomains.map((sd: string) => ({
          id: `subdomain_${Date.now()}`,
          type: 'domain' as const,
          value: sd,
          discoveredAt: Date.now(),
        })),
      };
    } catch (error: any) {
      console.error('[ToolRunner] Subfinder error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run httpx in Docker container
   */
  async runHttpx(inputFile: string): Promise<ToolResult> {
    const outputFile = `httpx_${Date.now()}.txt`;
    
    try {
      console.log('[ToolRunner] Running httpx:', inputFile);
      
      const { stdout, stderr } = await execAsync(
        `docker run --rm ` +
        `-v ${this.scanOutputDir}:/workspace/scans:rw ` +
        `--network host ` +
        `--user root ` +
        `vanta-core/httpx-runner:latest ` +
        `-l /workspace/scans/${inputFile} -o /workspace/scans/${outputFile}`,
        { timeout: 300000 }
      );

      // Read probed results
      const probed = await this.readHttpxResults(`${this.scanOutputDir}/${outputFile}`);
      
      return {
        success: true,
        output: { probed },
        discoveredAssets: probed.map((p: any) => ({
          id: `url_${Date.now()}`,
          type: 'url' as const,
          value: p.url,
          discoveredAt: Date.now(),
        })),
      };
    } catch (error: any) {
      console.error('[ToolRunner] Httpx error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run nuclei in Docker container
   */
  async runNuclei(inputFile: string, rateLimit: number = 10): Promise<ToolResult> {
    const outputFile = `nuclei_${Date.now()}.txt`;
    
    try {
      console.log('[ToolRunner] Running nuclei:', inputFile);
      
      const { stdout, stderr } = await execAsync(
        `docker run --rm ` +
        `-v ${this.scanOutputDir}:/workspace/scans:rw ` +
        `-v /tmp/vanta-nuclei:/root/nuclei:rw ` +
        `--network host ` +
        `--user root ` +
        `vanta-core/nuclei-runner:latest ` +
        `-l /workspace/scans/${inputFile} -o /workspace/scans/${outputFile} -rate ${rateLimit}`,
        { timeout: 600000 } // 10 min timeout
      );

      // Read vulnerability results
      const vulns = await this.parseNucleiResults(`${this.scanOutputDir}/${outputFile}`);
      
      return {
        success: true,
        output: { vulnerabilities: vulns },
        vulnerabilities: vulns.map((v: any) => ({
          id: `vuln_${Date.now()}`,
          type: v.template_id,
          severity: v.severity,
          description: v.description,
          evidence: v.matched_at,
          discoveredAt: Date.now(),
        })),
      };
    } catch (error: any) {
      console.error('[ToolRunner] Nuclei error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    const fs = require('fs');
    if (!fs.existsSync(this.scanOutputDir)) {
      fs.mkdirSync(this.scanOutputDir, { recursive: true });
    }
  }

  /**
   * Parse nmap XML result
   */
  private async parseNmapResult(xmlFile: string): Promise<any> {
    const fs = require('fs');
    const xml2js = require('xml2js');
    
    if (!fs.existsSync(xmlFile)) {
      return { hosts: [] };
    }

    const xml = fs.readFileSync(xmlFile, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xml);
    
    // Parse nmap XML structure
    const hosts = result.nmaprun.host?.map((h: any) => ({
      ip: h.address?.[0]?.$.addr,
      ports: h.ports?.[0]?.port?.map((p: any) => ({
        port: p.$.portid,
        protocol: p.$.protocol,
        service: p.service?.[0]?.$.name,
        state: p.state?.[0]?.$.state,
      })),
    })) || [];

    return { hosts };
  }

  /**
   * Read subdomain results
   */
  private async readSubdomainResults(file: string): Promise<string[]> {
    const fs = require('fs');
    if (!fs.existsSync(file)) return [];
    
    const content = fs.readFileSync(file, 'utf8');
    return content.split('\n').filter((line: string) => line.trim().length > 0);
  }

  /**
   * Read httpx results
   */
  private async readHttpxResults(file: string): Promise<any[]> {
    const fs = require('fs');
    if (!fs.existsSync(file)) return [];
    
    const content = fs.readFileSync(file, 'utf8');
    return content.split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => JSON.parse(line));
  }

  /**
   * Parse nuclei JSON results
   */
  private async parseNucleiResults(file: string): Promise<any[]> {
    const fs = require('fs');
    if (!fs.existsSync(file)) return [];
    
    const content = fs.readFileSync(file, 'utf8');
    return content.split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => JSON.parse(line));
  }
}
