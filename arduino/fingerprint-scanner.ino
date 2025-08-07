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
byte pin_column[COLUMN_NUM] = {7, 6, 5, 4};
Keypad keypad = Keypad(makeKeymap(keys), pin_rows, pin_column, ROW_NUM, COLUMN_NUM );

// --- Fingerprint ---
SoftwareSerial fingerSerial(2, 3); // RX, TX
Adafruit_Fingerprint finger(&fingerSerial);

// --- States ---
bool enrollMode = false;
unsigned long lastRTCUpdate = 0;

// EEPROM helpers
const int MAX_USERS = 127;
const int SERVICE_NUM_LEN = 8;
const int EEPROM_START = 0;

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

// Find first free fingerprint slot
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
  char key = keypad.getKey();
  if (key == 'A') {
    enrollMode = !enrollMode;
    lcd.clear();
    delay(500);
  }

  if (enrollMode) {
    handleEnroll();
  } else {
    if (millis() - lastRTCUpdate >= 1000) {
      showWelcomeAndTime();
      lastRTCUpdate = millis();
    }
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

void handleEnroll() {
  String serviceNum = "";
  lcd.setCursor(0, 0);
  lcd.print("SVC NO:  #=OK *=Del");
  lcd.setCursor(0, 1);
  lcd.print("> ");

  while (true) {
    char key = keypad.getKey();
    if (key) {
      if (key >= '0' && key <= '9') {
        if (serviceNum.length() < SERVICE_NUM_LEN) {
          serviceNum += key;
          lcd.setCursor(2, 1);
          lcd.print(serviceNum + "        ");
        }
      } else if (key == '*') {
        if (serviceNum.length() > 0) {
          serviceNum.remove(serviceNum.length() - 1);
          lcd.setCursor(2, 1);
          lcd.print(serviceNum + "        ");
        }
      } else if (key == '#') {
        if (serviceNum.length() > 0) {
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Enrolling...");
          delay(1000);
          enrollProcess(serviceNum);
          enrollMode = false;
          lcd.clear();
          return;
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
  lcd.setCursor(0, 0);
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

  lcd.setCursor(0, 0);
  lcd.print("Remove finger");
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER);

  lcd.setCursor(0, 0);
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
    lcd.setCursor(0, 1);
    lcd.print("Store error");
  }
  delay(2000);
}

void checkFingerprint() {
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
