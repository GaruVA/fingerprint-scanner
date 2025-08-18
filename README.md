# Fingerprint-Based Attendance System (Arduino)

## Overview

This project implements a fingerprint-based attendance system using:

* **Arduino Uno**
* **AS608 Optical Fingerprint Sensor**
* **20x4 I2C LCD**
* **RTC (DS3231 or compatible)**
* **4x4 Keypad**
* **EEPROM storage** for service numbers

It supports multiple modes accessible from the home screen:

* **Enroll Mode (A):** Register a new fingerprint with an associated service number.
* **Delete Mode (B):** Delete a fingerprint record by entering its service number.
* **Wipe Mode (D):** Erase all fingerprints and service numbers.

The system continuously displays date and time on the LCD when no mode is active.

---

## Features

* Real-time **welcome screen** with date and time
* **Fingerprint enrollment** and deletion
* **EEPROM storage** for service numbers (max 127 users, 7-digit service numbers)
* **Toggleable modes** directly from the keypad (A/B/D)
* Supports **3.3V fingerprint sensor** and 5V peripherals
* Safe **buck converter power supply** support

---

## Hardware Setup

### Connections

| Component                | Arduino Pin        | Notes                                         |
| ------------------------ | ------------------ | --------------------------------------------- |
| Fingerprint Sensor       | 2 (RX), 3 (TX)     | Sensor uses 3.3V; use level shifter if needed |
| LCD (I2C)                | A4 (SDA), A5 (SCL) | 20x4 LCD                                      |
| RTC (I2C)                | A4 (SDA), A5 (SCL) | Shares bus with LCD                           |
| Keypad Rows              | 8,9,10,11          | 4x4 Keypad                                    |
| Keypad Columns           | 7,6,5,4            | 4x4 Keypad                                    |
| Buck Converter 5V Output | Arduino 5V / GND   | Powers Arduino and peripherals                |

> High-voltage input (12V wall adapter or 2S Li-ion) → buck converter → 5V Arduino rail.
> Buck input should have protection (fuse + reverse-polarity diode) if used in a PCB.

---

## Software

### Libraries Required

* [LiquidCrystal\_I2C](https://github.com/johnrickman/LiquidCrystal_I2C)
* [Keypad](https://playground.arduino.cc/Code/Keypad/)
* [Adafruit Fingerprint Sensor Library](https://github.com/adafruit/Adafruit-Fingerprint-Sensor-Library)
* [uRTCLib](https://github.com/RobTillaart/RTClib)

### Configuration

* **Max Users:** `MAX_USERS = 127`
* **Service Number Length:** `SERVICE_NUM_LEN = 7`
* **EEPROM Start Address:** `EEPROM_START = 0`

> Adjust `SERVICE_NUM_LEN` if your service numbers differ. Ensure EEPROM size can accommodate MAX\_USERS × SERVICE\_NUM\_LEN bytes.

---

## Usage

1. **Power on** the system.
2. LCD displays **Welcome screen + date/time**.
3. **Toggle modes:**

   * Press **A** → Enroll Mode
   * Press **B** → Delete Mode
   * Press **D** → Wipe Mode
4. **Enroll Mode:** Enter 7-digit service number → press `#` → follow prompts to scan fingerprint twice.
5. **Delete Mode:** Enter service number → press `#` → deletes fingerprint + EEPROM record if found.
6. **Wipe Mode:** Press `D` again to confirm → deletes all fingerprints and EEPROM records.

> While in any mode, the system stops fingerprint scanning. Returning to the home screen resumes scanning.

---

## EEPROM Storage

* Each fingerprint ID stores its **service number** in EEPROM.
* **Storage layout:**

```
Address 0–6      → Finger ID 0 service number
Address 7–13     → Finger ID 1 service number
...
Address 1016–1022 → Finger ID 127 service number
```

* Service numbers are padded with spaces if shorter than 7 digits.
* Functions:

  * `storeServiceNumber(fid, svcNum)` → Writes to EEPROM
  * `getServiceNumber(fid)` → Reads from EEPROM
  * `trimString()` → Removes trailing spaces

---

## Notes

* Buck converter chosen: **5V, 3A** output is sufficient for Arduino + LCD + Fingerprint Sensor.
* Fingerprint sensor requires **3.3V** supply; use onboard regulator or dedicated 3.3V rail.
* Only one mode can be active at a time.
* Deleting or wiping is **permanent**; ensure confirmation steps are followed.

---

## Safety & Power

* Use a **fused input** to protect against shorts.
* **Reverse-polarity protection** is recommended if connecting directly to high-voltage sources.
* Keep **buck converter input accessible** for future battery or adapter swaps.

---

## References

* [Adafruit Fingerprint Sensor Library](https://github.com/adafruit/Adafruit-Fingerprint-Sensor-Library)
* [Arduino Keypad Library](https://playground.arduino.cc/Code/Keypad/)
* [LiquidCrystal\_I2C](https://github.com/johnrickman/LiquidCrystal_I2C)
* [RTC Libraries & Examples](https://github.com/RobTillaart/RTClib)

