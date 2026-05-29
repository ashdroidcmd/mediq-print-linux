SETUP UBUNTU PC USB ONLY CONNECTION FOR PRINTER

sudo apt update

sudo apt install -y \
cups \
usbutils \
libudev-dev \
build-essential

Detect Printer

Plug printer in.

Run:

lsusb

Expected:

Seiko Epson Corp.
Check Device Node
ls /dev/usb/

Usually:

lp0

Then:

ls -lah /dev/usb/lp0

RUN
echo "HELLO EPSON TM-T82II TEST" | sudo tee /dev/usb/lp0

STEP 3 — Fix permissions (common issue)

Run:

sudo usermod -aG lp $USER
sudo usermod -aG dialout $USER

Then:

reboot

====================================================

Install node js and git

then git clone this repo

change directory to the folder

then npm install

npm run server
