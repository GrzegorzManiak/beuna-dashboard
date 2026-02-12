bun i concurrently unset NODE_ENV bun install --cwd ./client

# immediate (until reboot)
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=0

# persist across reboots
echo "net.ipv4.ip_unprivileged_port_start=0" | sudo tee /etc/sysctl.d/99-unprivileged-ports.conf sudo sysctl --system


buena.grzegorz.ie