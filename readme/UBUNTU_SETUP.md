# 🖨️ EPSON TM-T82II Thermal Printer - Ubuntu Linux Test

## Quick Start (5 Minutes)

### 1️⃣ Prerequisites

- Ubuntu 20.04+ LTS
- Node.js 14+
- EPSON TM-T82II printer

### 2️⃣ Install System Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nodejs npm

# For USB printer support
sudo apt install -y libusb-1.0-0 libusb-1.0-0-dev

# For network printer support (CUPS)
sudo apt install -y cups cups-client avahi-daemon
```

### 3️⃣ Setup Project

```bash
# Clone/navigate to test-print-linux folder
cd test-print-linux

# Install Node dependencies
npm install

# Verify Node.js version
node --version  # Should be 14+
npm --version   # Should be 6+
```

### 4️⃣ Detect Your Printer

```bash
# Auto-detect connected printers
npm run detect

# Output will show:
# ✓ USB Printers detected
# ✓ Network Printers found
# ✓ USB permissions status
```

### 5️⃣ Run Test Print

Choose one based on your printer connection:

#### Option A: Auto-Detect (Recommended)

```bash
npm test
# or
node test-print.js
```

#### Option B: Network Printer (TCP/IP)

```bash
# Find your printer IP address
npm run detect

# Print to specific IP
npm run test:tcp 192.168.1.100
# or
node test-print.js --tcp 192.168.1.100
```

#### Option C: USB Printer

```bash
npm run test:usb
# or
node test-print.js --usb
```

---

## 🔌 Connection Types

### Network Printer (TCP/IP) - Recommended

**Advantages:**

- No permissions issues
- Works from any machine on network
- Easier to debug
- Preferred for multi-user environments

**Setup:**

1. Connect printer to network (Ethernet)
2. Print configuration page from printer menu
3. Note the IP address (e.g., 192.168.1.100)
4. Run: `npm run test:tcp 192.168.1.100`

**Test Connection:**

```bash
# Check if printer is reachable
ping 192.168.1.100

# Check if port 9100 is open
nc -zv 192.168.1.100 9100

# Or use bash built-in
bash -c 'echo > /dev/tcp/192.168.1.100/9100' && echo "✓ Connected" || echo "❌ Failed"
```

### USB Printer

**Advantages:**

- Direct connection
- No network setup needed
- Faster communication

**Prerequisites:**

```bash
# Grant USB printer permissions
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER

# Log out and back in for changes to take effect
exit
```

**Find USB Device:**

```bash
# List all USB devices
lsusb

# Look for: Bus 001 Device 003: ID 04b8:0202 Seiko Epson Corp. TM-T82

# List USB printer device files
ls -la /dev/usb/lp*
# Should show: /dev/usb/lp0 or similar

# Check device permissions
ls -la /dev/usb/lp0
# Should show: crw-rw---- 1 root lpadmin (you need rw access)
```

**Run Test:**

```bash
npm run test:usb
# or
node test-print.js --usb
```

---

## 📋 Full Installation Steps

### Step 1: System Dependencies

```bash
# RHEL/CentOS/Fedora
sudo yum install -y nodejs npm libusb-devel cups

# Debian/Ubuntu (including WSL2)
sudo apt-get update
sudo apt-get install -y nodejs npm libusb-1.0-0-dev cups

# Arch Linux
sudo pacman -S nodejs npm libusb
```

### Step 2: Node.js Version Check

```bash
# Must be 14+
node --version
# v14.0.0 or higher

# If not, install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Step 3: Clone/Setup Project

```bash
# If in git repo
git clone <repo-url> mediq
cd mediq/test-print-linux

# If standalone
mkdir test-print-linux
cd test-print-linux
npm init -y
npm install node-thermal-printer chalk
```

### Step 4: Install Node Packages

```bash
npm install
# Installs: node-thermal-printer, chalk
```

### Step 5: Printer Setup

#### For USB Printer:

```bash
# Add yourself to printer groups
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER

# Verify with:
groups
# Should show: lpadmin dialout

# Check USB device
lsusb | grep -i epson
ls -la /dev/usb/lp*
```

#### For Network Printer:

```bash
# Find printer IP
# 1. Print config page from printer menu
# 2. Look for IP address (e.g., 192.168.1.100)
# 3. Test connectivity:
ping 192.168.1.100
nc -zv 192.168.1.100 9100  # Should say "succeeded"
```

### Step 6: Test Print

```bash
# Auto-detect (tries both TCP and USB)
npm test

# Expected output:
# ═══════════════════════════════════════
#   EPSON TM-T82II Ubuntu Linux Test Print
# ═══════════════════════════════════════
# ✓ Connected to TCP printer at 192.168.1.100:9100
# ✓ Print job sent successfully!
```

---

## 🛠️ Useful Commands

### Printer Detection

```bash
# CUPS printer status
lpstat -p -d
lpstat -p -l

# List CUPS drivers
lpinfo -l -h localhost --list-available-devices

# USB printer detection
lsusb
lsusb -v  # Detailed info

# Check USB device files
ls -la /dev/usb/lp*

# Your groups/permissions
groups $USER
id
```

### Network Diagnostics

```bash
# Ping printer
ping 192.168.1.100

# Check port 9100
nc -zv 192.168.1.100 9100
telnet 192.168.1.100 9100  # Press Ctrl+C to exit

# bash built-in (no external tools needed)
bash -c 'echo > /dev/tcp/192.168.1.100/9100' && echo "✓ Port open"

# nmap scan
nmap -p 9100 192.168.1.100
```

### USB Troubleshooting

```bash
# Check current user USB access
ls -la /dev/usb/lp0

# Check if you're in the right group
id
groups

# List all devices by EPSON
lsusb | grep -i epson

# Detailed EPSON device info
lsusb -D /dev/bus/usb/001/003  # Adjust bus/device numbers
```

### Print Queue Management

```bash
# Check CUPS daemon
sudo systemctl status cups

# Start CUPS
sudo systemctl start cups

# View print queue
lpq -P<printer_name>

# Cancel print jobs
cancel -a  # Cancel all jobs

# Monitor CUPS
sudo tail -f /var/log/cups/error_log
```

---

## 📚 Sample Configurations

### TCP/IP Printer (Network)

```javascript
// Automatically detected by npm run test:tcp <IP>
const config = {
  type: "tcp",
  host: "192.168.1.100",
  port: 9100, // EPSON standard
};
```

### USB Printer

```javascript
// Automatically detected by npm run test:usb
const config = {
  type: "file",
  filename: "/dev/usb/lp0", // Adjust if different
};
```

### Auto-Detect (Default)

```javascript
// npm test
// Tries TCP first, falls back to USB
```

---

## ⚠️ Common Issues & Solutions

### ❌ "Permission denied" (USB)

```bash
# Solution 1: Add to group
sudo usermod -a -G lpadmin $USER
sudo usermod -a -G dialout $USER
# Log out and back in

# Solution 2: Check file permissions
ls -la /dev/usb/lp0
# Should show: crw-rw---- (not crw-------)

# Solution 3: Fix permissions (temporary)
sudo chmod 666 /dev/usb/lp0  # Not permanent after reboot
```

### ❌ "Cannot find module 'node-thermal-printer'"

```bash
# Make sure you're in test-print-linux folder
cd test-print-linux

# Install dependencies
npm install

# Verify installation
npm ls
```

### ❌ "Connection refused" (TCP/IP)

```bash
# 1. Check printer IP
ping 192.168.1.100

# 2. Check port is open
nc -zv 192.168.1.100 9100
# Should say: "Connection succeeded"

# 3. Verify printer is powered on
# 4. Check printer network settings (print config page)

# 5. Try different port (some printers use 515, 631)
# Edit test-print.js and change port to 515
```

### ❌ "No device found" (USB)

```bash
# 1. Check if printer is detected
lsusb | grep -i epson

# 2. Install libusb
sudo apt install -y libusb-1.0-0 libusb-1.0-0-dev

# 3. Rebuild node-thermal-printer
npm rebuild node-thermal-printer --build-from-source

# 4. Check device file exists
ls -la /dev/usb/lp*

# 5. Try different device
# /dev/usb/lp0, /dev/usb/lp1, /dev/lp0, /dev/lp1
```

### ❌ "Timeout waiting for response"

```bash
# Usually means printer is offline or not responding

# For TCP:
# 1. Power cycle printer
# 2. Check network cable
# 3. Check firewall rules: sudo ufw status

# For USB:
# 1. Unplug and re-plug USB cable
# 2. Check dmesg for errors: dmesg | tail -20
# 3. Rebuild driver: npm rebuild node-thermal-printer --build-from-source
```

### ❌ "Port X already in use"

```bash
# Only applies if running your own server
# Not relevant for this test script
```

---

## ✅ Verification Checklist

```bash
# 1. Node.js installed
node --version  # Should be v14+

# 2. npm installed
npm --version   # Should be 6+

# 3. Project dependencies
npm ls
# Should show: node-thermal-printer, chalk

# 4. Printer detected
npm run detect
# Should show USB or network printers

# 5. Permissions correct (USB only)
groups
# Should include: lpadmin, dialout

# 6. Network connectivity (TCP only)
ping 192.168.1.100  # Your printer IP

# 7. Port accessible (TCP only)
nc -zv 192.168.1.100 9100  # Should succeed

# 8. Test print works
npm test
# Should print a test receipt
```

---

## 📞 Quick Reference

### Start Testing

```bash
npm test              # Auto-detect
npm run test:tcp 192.168.1.100   # Network
npm run test:usb      # USB
```

### Detect Printers

```bash
npm run detect        # Find all printers
```

### Help

```bash
npm run help          # Show command help
node test-print.js --help
```

### System Info

```bash
uname -a              # System info
lsusb                 # USB devices
lpstat -p -d          # CUPS printers
```

---

## 🎯 Success Indicators

When successful, you should see:

✓ Connected to printer
✓ Print job sent successfully!
✓ Test receipt prints from thermal printer
✓ Paper is auto-cut

---

## 📖 Next Steps

1. ✅ Test print works reliably
2. ✅ Document printer IP/USB path
3. ✅ Create production print server (Express.js)
4. ✅ Integrate with frontend
5. ✅ Add queue management

For now, this test application confirms your printer works on Ubuntu Linux!
