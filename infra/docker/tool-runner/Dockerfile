FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    nmap \
    dnsutils \
    curl \
    wget \
    netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Run as non-root for security
RUN useradd -m scanner
USER scanner

ENTRYPOINT ["nmap"]
