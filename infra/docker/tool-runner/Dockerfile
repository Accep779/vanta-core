FROM kalilinux/kali-rolling:latest

LABEL description="VANTA Core Tool Runner - Multi-tool security scanner"
LABEL version="1.0"

# Install comprehensive security toolset
RUN apt-get update && apt-get install -y \
    nmap \
    dnsutils \
    whois \
    curl \
    wget \
    netcat-openbsd \
    ncat \
    traceroute \
    iputils-ping \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Create non-root user for security
RUN useradd -m -s /bin/bash scanner && \
    chown -R scanner:scanner /workspace

# Switch to non-root user
USER scanner

# Default entrypoint (overridden by docker-compose)
ENTRYPOINT []
CMD ["/bin/bash"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
