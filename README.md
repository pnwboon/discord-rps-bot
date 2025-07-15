# บอทเป่ายิงฉุบ (Rock-Paper-Scissors Discord Bot) ✨
* **เกมเป่ายิงฉุบแบบ Player vs Player (PvP):**
    * ผู้เล่นสามารถเริ่มต้นเกมได้ด้วยคำสั่ง Slash Command `/rps`
* **ระบบจัดเก็บสถิติผู้เล่น:**
    * บอทจะบันทึกสถิติการเล่นของแต่ละคนโดยอัตโนมัติ
    * **ข้อมูลที่บันทึก:** จำนวนครั้งที่เล่น (Played), จำนวนครั้งที่ชนะ (Wins), และจำนวนครั้งที่แพ้ (Losses)
    * ข้อมูลถูกจัดเก็บในไฟล์ `data.json`
* **กระดานผู้นำ (Leaderboard):**
    * แสดงอันดับผู้เล่นที่มีจำนวนครั้งที่ชนะมากที่สุด
    * แสดงผู้เล่นสูงสุด 10 อันดับแรก
* **การเข้าถึงสถิติและกระดานผู้นำในที่เดียว:**
    * ใช้คำสั่ง `/rpscheck` เพื่อดูสถิติส่วนตัวและกระดานผู้นำทั้งหมดในข้อความเดียว
 
## 💻 ภาษาและเทคโนโลยีที่ใช้
* **JavaScript**
* **Node.js**
* **Discord.js**
* **dotenv**
* **JSON**

## 🛠️ การตั้งค่าและการติดตั้ง
### 1. **โคลน Repository:**
   เปิด Terminal หรือ Command Prompt แล้วใช้คำสั่ง:
   ```bash
   git clone https://github.com/pnwboon/discord-rps-bot.git
   ```
### 2. **ติดตั้งแพ็กเกจที่จำเป็น:**
   ```bash
   npm install
   ```
### 3. **สร้าง Application บอท:**
   ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
    
### 4. **Bot Permissions:**
   **`Send Messages`**, **`Use Slash Commands`**, **`View Channels`**

### 5. **สร้างไฟล์ข้อมูล `data.json`:**
   ```json
    {
        "gameResults": [],
        "playerStats": {}
    }
   ```

### 6. **สร้างไฟล์ `.env`:**
   ```
   DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
   ```
   **แทนที่ `YOUR_BOT_TOKEN_HERE` ด้วย Token ที่คุณคัดลอกจาก Discord Developer Portal**

### 7. **ลงทะเบียน Slash Commands:**
   ```bash
   node deploy-commands.js
   ```
### 8. **รันบอท**
   ```bash
   node index.js
   ```
