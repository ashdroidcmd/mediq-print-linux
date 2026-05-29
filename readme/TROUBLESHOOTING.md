# 🛠️ Troubleshooting Guide - EPSON TM-T82II on Ubuntu Linux

## Quick Diagnosis

Run this to identify your issue:

```bash
npm run detect
# This will show:
# ✓ USB printers detected
# ✓ Network printers found
# ✓ Permission status
# ✓ Scanning IP addresses
```

---

## Issue Categories

### 🔌 USB Connection Issues

#### Issue: "Cannot find /dev/usb/lp0" or "No such file or directory"

**Diagnosis:**

```bash
# Check if device file exists
ls -la /dev/usb/lp*
ls -la /dev/lp*

# List all USB devices
lsusb
lsusb | grep -i epson
```

**Causes & Solutions:**

1. **Printer not connected via USB**
   - Physical check: Ensure USB cable is connected
   - Try different USB port on computer
   - Try different USB cable (test cable)

2. **Device file doesn't exist**
   - Install CUPS:
     ```bash
     sudo apt-get install -y cups cups-client
     sudo systemctl start cups
     ```
   - Reinstall printer driver:
     ```bash
     sudo apt-get remove --purge printer-driver-epson
     sudo apt-get install -y printer-driver-epson
     ```
   - Reboot:
     ```bash
     sudo reboot
     ```

3. **Printer not detected by kernel**
   - Check kernel logs:
     ```bash
     dmesg | tail -20 | grep -i usb
     dmesg | tail -20 | grep -i epson
     ```
   - Install libusb:
     ```bash
     sudo apt-get install -y libusb-1.0-0 libusb-1.0-0-dev
     npm rebuild node-thermal-printer --build-from-source
     ```

4. **Multiple USB printers - wrong device**
   - List all USB printers:
     ```bash
     ls -la /dev/usb/lp*
     # Might show: /dev/usb/lp0, /dev/usb/lp1, etc.
     ```
   - Identify correct printer:
     ```bash
     # Try each device
     node test-print.js --usb
     # Edit test-print.js and change filename to /dev/usb/lp1
     ```

---

#### Issue: "Permission denied" on /dev/usb/lp0

**Diagnosis:**

```bash
ls -la /dev/usb/lp0
# Should show: crw-rw---- 1 root lpadmin
# You need: rw (read-write) permissions
```

**Solutions:**

1. **Add yourself to printer group (Recommended)**

   ```bash
   sudo usermod -a -G lpadmin $USER
   sudo usermod -a -G dialout $USER

   # Verify
   groups
   # Should show: lpadmin, dialout

   # Important: Log out and log back in for changes to take effect
   exit  # Close terminal, open new one
   ```

2. **Check current group membership**

   ```bash
   id
   # Look for gid=...(lpadmin) or gid=...(dialout)
   ```

3. **Temporary fix (until reboot)**

   ```bash
   sudo chmod 666 /dev/usb/lp0
   ```

4. **Permanent fix via udev rules**

   ```bash
   # Create udev rule for EPSON printers
   sudo bash -c 'cat > /etc/udev/rules.d/60-epson-printer.rules << EOF
   SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0202", MODE="0666"
   EOF'

   # Reload udev rules
   sudo udevadm control --reload-rules
   sudo udevadm trigger

   # Unplug and re-plug printer USB
   ```

---

#### Issue: "Device busy" or "In use by another process"

**Diagnosis:**

```bash
# Check if printer is already open
lsof | grep /dev/usb/lp0

# Check CUPS daemon
ps aux | grep -i cupsd

# Check other processes
ps aux | grep -i print
```

**Solutions:**

1. **Kill other print processes**

   ```bash
   pkill -f "node.*test-print"
   pkill -f lpd
   ```

2. **Restart CUPS**

   ```bash
   sudo systemctl restart cups
   ```

3. **Clear stuck print jobs**

   ```bash
   # Cancel all jobs
   cancel -a

   # Clear CUPS spool
   sudo rm -rf /var/spool/cups/*

   # Restart CUPS
   sudo systemctl restart cups
   ```

---

### 📡 Network Connection Issues

#### Issue: "Connection refused" on TCP/IP

**Diagnosis:**

```bash
# Check if printer responds
ping 192.168.1.100
# Should show: bytes from 192.168.1.100

# Check port 9100
nc -zv 192.168.1.100 9100
# Should show: Connection succeeded

# Or use bash built-in
bash -c 'echo > /dev/tcp/192.168.1.100/9100' && echo "✓ Port open"
```

**Solutions:**

1. **Verify printer IP address**

   ```bash
   # Print configuration page from printer menu
   # Look for "Network Settings" or "IP Address"
   # Common: 192.168.1.100, 192.168.0.100, 10.0.0.100

   # Or scan network:
   nmap -p 9100 192.168.1.0/24 2>/dev/null | grep -B 5 "9100/tcp"
   ```

2. **Check network connectivity**

   ```bash
   ping -c 4 192.168.1.100

   # If no response:
   # - Check printer is powered on
   # - Check Ethernet cable
   # - Check printer network settings
   # - Check if printer is on same subnet
   ```

3. **Verify port 9100 is open**

   ```bash
   # Multiple methods:
   nc -zv 192.168.1.100 9100
   telnet 192.168.1.100 9100  # Ctrl+C to exit
   bash -c 'echo > /dev/tcp/192.168.1.100/9100'
   nmap -p 9100 192.168.1.100
   ```

4. **Try different port numbers**

   ```bash
   # EPSON standard ports:
   # 9100  - Main printing port
   # 515   - LPD (Line Printer Daemon)
   # 631   - IPP (Internet Printing Protocol)
   # 80    - Web interface

   # Test each:
   for port in 9100 515 631 80; do
     bash -c "echo > /dev/tcp/192.168.1.100/$port" && echo "✓ Port $port open"
   done
   ```

5. **Check firewall**

   ```bash
   # UFW status
   sudo ufw status

   # Allow port 9100 to specific IP:
   sudo ufw allow from 192.168.1.100 to any port 9100

   # Or check iptables:
   sudo iptables -L -n | grep 9100
   ```

---

#### Issue: "Timeout" when connecting

**Diagnosis:**

```bash
# Set timeout for connection test
timeout 5 bash -c 'echo > /dev/tcp/192.168.1.100/9100' && echo "✓ Connected" || echo "❌ Timeout"
```

**Solutions:**

1. **Printer offline or powered off**
   - Check power indicator
   - Power cycle: Off → wait 10s → On

2. **Network issues**
   - Check Ethernet cable
   - Check switch/router port
   - Ping from router: `ping 192.168.1.100`

3. **Print server not responding**
   - Printer may be in error state
   - Check display on printer
   - Check error lights
   - Press reset button if available

4. **Network driver issue**
   ```bash
   # On printer, check network settings:
   # Print configuration page and verify:
   # - IP address is correct
   # - Gateway is set
   # - Subnet mask is correct (usually 255.255.255.0)
   ```

---

#### Issue: "getaddrinfo ENOTFOUND hostname"

**Diagnosis:**

```bash
# Make sure you're passing correct IP
npm run test:tcp 192.168.1.100  # Correct
npm run test:tcp epson.local    # May not work
```

**Solutions:**

1. **Use IP address instead of hostname**

   ```bash
   npm run test:tcp 192.168.1.100  # Works

   # Not:
   npm run test:tcp epson.local    # Might fail
   ```

2. **Enable mDNS/Bonjour if available**

   ```bash
   # Install avahi
   sudo apt-get install -y avahi-daemon avahi-utils

   # Discover printers
   avahi-browse -a | grep EPSON

   # Use mDNS hostname:
   npm run test:tcp epson.local  # May work now
   ```

---

### 💻 Node.js & Dependencies Issues

#### Issue: "Cannot find module 'node-thermal-printer'"

**Diagnosis:**

```bash
npm ls
# Should show: node-thermal-printer

# Check if installed
ls node_modules/ | grep thermal
```

**Solutions:**

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Clear cache and reinstall**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check you're in correct directory**

   ```bash
   pwd  # Should end with: test-print-linux
   ls -la package.json
   ```

4. **Install with sudo (not recommended but works)**
   ```bash
   sudo npm install --unsafe-perm
   ```

---

#### Issue: "node-thermal-printer rebuild fails"

**Diagnosis:**

```bash
npm rebuild node-thermal-printer
# If errors about Python, g++, make...
```

**Solutions:**

1. **Install build tools**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install -y build-essential python3

   # CentOS/RHEL
   sudo yum groupinstall -y "Development Tools"
   ```

2. **Install Node headers**

   ```bash
   npm install -g node-gyp
   ```

3. **Rebuild**
   ```bash
   npm rebuild node-thermal-printer --build-from-source
   ```

---

#### Issue: "Node.js version incompatible"

**Diagnosis:**

```bash
node --version
# Should be v14+, ideally v16+ or v18+
```

**Solutions:**

1. **Check required version**

   ```bash
   cat package.json | grep '"engines"'
   # Requires: "node": ">=14.0.0"
   ```

2. **Upgrade Node.js**

   ```bash
   # Method 1: NodeSource repository
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Method 2: NVM (Node Version Manager)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18

   # Verify
   node --version  # Should be v18+
   ```

---

### 🖨️ Printer-Specific Issues

#### Issue: "Printer not configured in CUPS"

**Solutions:**

1. **Add printer via CUPS web interface**

   ```bash
   # Open in browser
   http://localhost:631

   # Or use command line:
   lpstat -p -l
   ```

2. **Add printer via command line**

   ```bash
   # For USB
   sudo lpadmin -p EPSON_TM_T82II -E -v /dev/usb/lp0 -m everywhere

   # For network
   sudo lpadmin -p EPSON_TM_T82II -E -v socket://192.168.1.100:9100 -m everywhere
   ```

3. **Start CUPS daemon**
   ```bash
   sudo systemctl start cups
   sudo systemctl enable cups  # Start on boot
   ```

---

#### Issue: "Printer prints garbage" or "Wrong characters"

**Diagnosis:**

```bash
# Usually means encoding issue or wrong character set
# Epson TM-T82II uses: PC852 Latin-2 or UTF-8
```

**Solutions:**

1. **Check character encoding in test-print.js**
   - Ensure UTF-8 is used
   - Avoid special Unicode characters

2. **Reset printer**

   ```bash
   # Press reset button on printer (if available)
   # Or power cycle: Off → 10 seconds → On
   ```

3. **Check printer settings**
   - Print configuration page
   - Check "Character Set" setting
   - May need to set to UTF-8 or PC852

---

#### Issue: "Paper doesn't auto-cut" or "No paper cut"

**Solutions:**

1. **Check paper is in correct position**
   - Paper should be inserted into cut slot
   - Some printers require specific paper path

2. **Check cut command in test-print.js**

   ```javascript
   printer.cut(); // Should be called before close()
   ```

3. **Manual cut**
   - Use printer's manual cut lever if available
   - Check printer manual for cut blade operation

---

### 🔍 Debugging Steps

#### Enable verbose logging

```bash
# Set debug environment variable
DEBUG=* npm test

# Or in test-print.js, add:
const debug = require('debug')('printer')
debug('Connecting...')
```

#### Check all connected USB devices

```bash
lsusb
# Look for: Seiko Epson Corp.

# Get detailed info
lsusb -v | grep -A 20 "Seiko Epson"

# Specific device info
lsusb -D /dev/bus/usb/001/003  # Adjust numbers
```

#### Monitor system logs

```bash
# USB events
dmesg | tail -20
dmesg -w  # Watch logs in real-time (Ctrl+C to stop)

# Printer/CUPS events
sudo tail -f /var/log/cups/error_log
sudo tail -f /var/log/cups/access_log

# System events
journalctl -u cups -f  # CUPS service logs
journalctl -k -f       # Kernel logs
```

#### Network debugging

```bash
# Detailed connection info
strace -e trace=network npm run test:tcp 192.168.1.100 2>&1 | head -50

# Network traffic capture (advanced)
sudo tcpdump -i eth0 -n port 9100
```

---

## Quick Solutions by Error Message

| Error                                                    | Solution                                                 |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `EACCES: permission denied`                              | Add to lpadmin group: `sudo usermod -a -G lpadmin $USER` |
| `ENOENT: no such file or directory, open '/dev/usb/lp0'` | USB printer not connected or device missing              |
| `ECONNREFUSED`                                           | Printer offline or wrong IP address                      |
| `ETIMEDOUT`                                              | Network unreachable or printer not responding            |
| `Cannot find module`                                     | Run `npm install` in test-print-linux directory          |
| `getaddrinfo ENOTFOUND`                                  | Use IP address instead of hostname                       |
| `Port 9100 not open`                                     | Firewall blocking, printer offline, or wrong port        |
| `Device or resource busy`                                | Another process using printer, run `pkill -f "node"`     |

---

## Systematic Troubleshooting Flowchart

```
START
  ↓
Is Node.js installed? NO → Install Node.js v14+
  │ YES
  ↓
Are dependencies installed? NO → Run: npm install
  │ YES
  ↓
Is printer detected? NO → Run: npm run detect
  │  YES
  ↓
Is it USB or Network?
  │
  ├─ USB:
  │    ├─ Permission denied? → Run: sudo usermod -a -G lpadmin $USER
  │    └─ Device not found? → Check: lsusb, ls /dev/usb/lp*
  │
  └─ Network (TCP/IP):
       ├─ Can ping printer? NO → Check network cable, IP address
       └─ Port 9100 open? NO → Check firewall, printer settings
  │
  ↓
Run: npm test
  │
  ├─ SUCCESS → Print test receipt to printer ✓
  └─ FAILED → Check error message above
```

---

## Testing Checklist

```bash
# 1. Verify system
node --version        # v14+
npm --version         # 6+
uname -a              # Linux

# 2. Install deps
npm install

# 3. Detect printer
npm run detect        # Shows all printers

# 4. For USB:
ls -la /dev/usb/lp*  # Device exists?
groups                # User in lpadmin?

# 5. For Network:
ping 192.168.1.100    # Can reach?
nc -zv 192.168.1.100 9100  # Port open?

# 6. Test print
npm test              # Should print

# 7. Verify output
# Check printer output tray for test receipt
```

---

## Getting Help

If still stuck:

1. **Run full detection:**

   ```bash
   npm run detect > printer-info.txt 2>&1
   cat printer-info.txt
   ```

2. **Collect system info:**

   ```bash
   uname -a
   node --version
   npm --version
   dmesg | tail -50
   lpstat -p -l
   ```

3. **Save error output:**

   ```bash
   npm test 2>&1 | tee error-output.txt
   cat error-output.txt
   ```

4. **Check printer manual** for:
   - Network settings
   - USB driver requirements
   - Default IP address
   - Port numbers supported

---

**Still having issues? The printer is probably working, just needs the right configuration!** 🖨️✅
