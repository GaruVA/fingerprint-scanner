#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>
#include "uRTCLib.h"
#include <EEPROM.h>

// --- LCD ---
LiquidCrystal_I2C lcd(0x27, 20, 4);

// --- RTC ---
uRTCLib rtc(0x68);
char daysOfWeek[7][12] = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

// --- Keypad ---
const int ROW_NUM = 4;
const int COLUMN_NUM = 4;
char keys[ROW_NUM][COLUMN_NUM] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};
byte pin_rows[ROW_NUM] = {8, 9, 10, 11};
byte pin_column[COLUMN_NUM] = {4, 5, 6, 7};
Keypad keypad = Keypad(makeKeymap(keys), pin_rows, pin_column, ROW_NUM, COLUMN_NUM );

// --- Fingerprint ---
SoftwareSerial fingerSerial(2, 3); // RX, TX
Adafruit_Fingerprint finger(&fingerSerial);

// EEPROM helpers
const int MAX_USERS = 127;
const int SERVICE_NUM_LEN = 7;
const int EEPROM_START = 0;

unsigned long lastRTCUpdate = 0;

// Modes state
bool enrollMode = false;
bool deleteMode = false;
bool wipeMode = false;

void storeServiceNumber(uint8_t fid, const String& serviceNumber) {
  int addr = EEPROM_START + fid * SERVICE_NUM_LEN;
  for (int i = 0; i < SERVICE_NUM_LEN; i++) {
    EEPROM.write(addr + i, i < serviceNumber.length() ? serviceNumber[i] : ' ');
  }
}

String getServiceNumber(uint8_t fid) {
  if (fid >= MAX_USERS) return "";
  String result = "";
  int addr = EEPROM_START + fid * SERVICE_NUM_LEN;
  for (int i = 0; i < SERVICE_NUM_LEN; i++) {
    result += (char)EEPROM.read(addr + i);
  }
  return result;
}

String trimString(const String& str) {
  int end = str.length() - 1;
  while (end >= 0 && str[end] == ' ') {
    end--;
  }
  return str.substring(0, end + 1);
}

int getNextFreeFingerprintID() {
  for (int i = 0; i < MAX_USERS; i++) {
    if (finger.loadModel(i) != FINGERPRINT_OK) {
      return i;
    }
  }
  return -1; // All IDs taken
}

void setup() {
  Serial.begin(9600);
  finger.begin(57600);
  URTCLIB_WIRE.begin();
  lcd.init();
  lcd.backlight();
  lcd.clear();

  if (!finger.verifyPassword()) {
    lcd.setCursor(0, 0);
    lcd.print("FP sensor fail");
    while (1);
  }

  lcd.setCursor(0, 0);
  lcd.print("Initializing...");
  delay(1500);
  lcd.clear();
}

void loop() {
  // Update time display every second if no mode active
  if (!enrollMode && !deleteMode && !wipeMode) {
    if (millis() - lastRTCUpdate >= 1000) {
      showWelcomeAndTime();
      lastRTCUpdate = millis();
    }
  }

  char key = keypad.getKey();
  if (key) {
    // Toggle modes based on key pressed
    if (key == 'A') {
      enrollMode = !enrollMode;
      if (enrollMode) {
        deleteMode = false;
        wipeMode = false;
        enrollModeHandler();
      } else {
        lcd.clear();
      }
    } else if (key == 'B') {
      deleteMode = !deleteMode;
      if (deleteMode) {
        enrollMode = false;
        wipeMode = false;
        deleteModeHandler();
      } else {
        lcd.clear();
      }
    } else if (key == 'D') {
      wipeMode = !wipeMode;
      if (wipeMode) {
        enrollMode = false;
        deleteMode = false;
        wipeModeHandler();
      } else {
        lcd.clear();
      }
    }
  }

  // Only check fingerprint if no mode active
  if (!enrollMode && !deleteMode && !wipeMode) {
    checkFingerprint();
  }
}

void showWelcomeAndTime() {
  rtc.refresh();
  lcd.setCursor(5, 0);
  lcd.print("Welcome!!!");
  lcd.setCursor(4, 2);
  lcd.print(daysOfWeek[rtc.dayOfWeek() - 1]);
  lcd.print(" ");
  lcd.print(rtc.year());
  lcd.print("/");
  print2Digit(rtc.month());
  lcd.print("/");
  print2Digit(rtc.day());
  lcd.setCursor(6, 3);
  print2Digit(rtc.hour());
  lcd.print(":");
  print2Digit(rtc.minute());
  lcd.print(":");
  print2Digit(rtc.second());
}

void print2Digit(int num) {
  if (num < 10) lcd.print("0");
  lcd.print(num);
}

void enrollModeHandler() {
  String serviceNum = "";
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Enroll Mode");
  lcd.setCursor(0, 1);
  lcd.print("Enter SVC NO:");
  lcd.setCursor(0, 2);
  lcd.print("> ");

  while (enrollMode) {
    char key = keypad.getKey();
    if (key) {
      if (key >= '0' && key <= '9') {
        if (serviceNum.length() < SERVICE_NUM_LEN) {
          serviceNum += key;
          lcd.setCursor(2, 2);
          lcd.print(serviceNum + "        ");
        }
      } else if (key == '*') {
        if (serviceNum.length() > 0) {
          serviceNum.remove(serviceNum.length() - 1);
          lcd.setCursor(2, 2);
          lcd.print(serviceNum + "        ");
        }
      } else if (key == '#') {
        if (serviceNum.length() > 0) {
          lcd.clear();
          lcd.print("Enrolling...");
          delay(1000);
          enrollProcess(serviceNum);
          lcd.clear();
          serviceNum = "";
          lcd.setCursor(0, 0);
          lcd.print("Enroll Mode");
          lcd.setCursor(0, 1);
          lcd.print("Enter SVC NO:");
          lcd.setCursor(0, 2);
          lcd.print("> ");
        }
      } else if (key == 'A') {
        enrollMode = false;
        lcd.clear();
        return;
      }
    }
  }
}

void enrollProcess(String serviceNumber) {
  int id = getNextFreeFingerprintID();
  if (id == -1) {
    lcd.clear();
    lcd.print("All slots full");
    delay(2000);
    return;
  }

  int p = -1;
  lcd.clear();
  lcd.print("Place finger...");
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    if (p == FINGERPRINT_NOFINGER) continue;
    lcd.setCursor(0, 1);
    lcd.print("Scan error 1");
    delay(1000);
    return;
  }

  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    lcd.setCursor(0, 1);
    lcd.print("Image err 1");
    delay(1000);
    return;
  }

  lcd.clear();
  lcd.print("Remove finger");
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER);

  lcd.clear();
  lcd.print("Place again...");
  p = -1;
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    if (p == FINGERPRINT_NOFINGER) continue;
    lcd.setCursor(0, 1);
    lcd.print("Scan error 2");
    delay(1000);
    return;
  }

  if (finger.image2Tz(2) != FINGERPRINT_OK) {
    lcd.setCursor(0, 1);
    lcd.print("Image err 2");
    delay(1000);
    return;
  }

  if (finger.createModel() != FINGERPRINT_OK) {
    lcd.setCursor(0, 1);
    lcd.print("Model fail");
    delay(1000);
    return;
  }

  if (finger.storeModel(id) == FINGERPRINT_OK) {
    storeServiceNumber(id, serviceNumber);
    lcd.clear();
    lcd.print("Stored FP ID ");
    lcd.print(id);
  } else {
    lcd.clear();
    lcd.print("Store error");
  }
  delay(2000);
}

void deleteModeHandler() {
  String svcNum = "";
  lcd.clear();
  lcd.print("Delete Mode");
  lcd.setCursor(0, 1);
  lcd.print("Enter SVC NO:");
  lcd.setCursor(0, 2);
  lcd.print("> ");

  while (deleteMode) {
    char key = keypad.getKey();
    if (key) {
      if (key >= '0' && key <= '9') {
        if (svcNum.length() < SERVICE_NUM_LEN) {
          svcNum += key;
          lcd.setCursor(2, 2);
          lcd.print(svcNum + "        ");
        }
      } else if (key == '*') {
        if (svcNum.length() > 0) {
          svcNum.remove(svcNum.length() - 1);
          lcd.setCursor(2, 2);
          lcd.print(svcNum + "        ");
        }
      } else if (key == '#') {
        bool found = false;
        for (int id = 0; id < MAX_USERS; id++) {
          if (trimString(getServiceNumber(id)) == svcNum) {
            if (finger.deleteModel(id) == FINGERPRINT_OK) {
              storeServiceNumber(id, "        ");
              lcd.clear();
              lcd.print("Deleted ID ");
              lcd.print(id);
            } else {
              lcd.clear();
              lcd.print("Delete failed");
            }
            delay(2000);
            found = true;
            svcNum = "";
            lcd.clear();
            lcd.print("Delete Mode");
            lcd.setCursor(0, 1);
            lcd.print("Enter SVC NO:");
            lcd.setCursor(0, 2);
            lcd.print("> ");
            break;
          }
        }
        if (!found) {
          lcd.clear();
          lcd.print("Not found");
          delay(2000);
          svcNum = "";
          lcd.clear();
          lcd.print("Delete Mode");
          lcd.setCursor(0, 1);
          lcd.print("Enter SVC NO:");
          lcd.setCursor(0, 2);
          lcd.print("> ");
        }
      } else if (key == 'B') {
        deleteMode = false;
        lcd.clear();
        return;
      }
    }
  }
}

void wipeModeHandler() {
  lcd.clear();
  lcd.print("Wipe Mode");
  lcd.setCursor(0, 1);
  lcd.print("Press D again");
  lcd.setCursor(0, 2);
  lcd.print("to confirm");

  unsigned long startTime = millis();

  while (wipeMode) {
    char key = keypad.getKey();

    // Cancel wipe if timeout exceeded
    if (millis() - startTime > 1500) { // 1.5 seconds timeout
      wipeMode = false;
      lcd.clear();
      return;
    }

    if (key) {
      if (key == 'D') {
        lcd.clear();
        lcd.print("Wiping all...");
        delay(1000);

        for (int id = 0; id < MAX_USERS; id++) {
          finger.deleteModel(id);
          storeServiceNumber(id, "        ");
        }

        lcd.clear();
        lcd.print("All data wiped");
        delay(2000);

        wipeMode = false;
        lcd.clear();
        return;
      } else {
        // Any other key cancels wipe
        wipeMode = false;
        lcd.clear();
        lcd.print("Wipe cancelled");
        delay(1500);
        lcd.clear();
        return;
      }
    }
  }
}

void checkFingerprint() {
  if (enrollMode || deleteMode || wipeMode) return;

  if (finger.getImage() != FINGERPRINT_OK) return;
  if (finger.image2Tz() != FINGERPRINT_OK) return;
  if (finger.fingerSearch() != FINGERPRINT_OK) {
    lcd.clear();
    lcd.print("No match");
    delay(2000);
    lcd.clear();
    return;
  }
  lcd.clear();
  lcd.print("FP ID: ");
  lcd.print(finger.fingerID);
  lcd.setCursor(0, 1);
  lcd.print("SvcNo: ");
  lcd.print(getServiceNumber(finger.fingerID));
  delay(3000);
  lcd.clear();
}
