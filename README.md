# 📊 LeetCode Tracker Dashboard

An interactive dashboard to visualize your LeetCode progress with automatic daily syncing, analytics, and filtering capabilities.

## 🚀 Features

- **📈 Interactive Charts**: Visualize problems by difficulty and topics
- **🔍 Advanced Filtering**: Filter by difficulty, topic, or search by problem title
- **📊 Real-time Analytics**: View total solved, acceptance rates, and distribution
- **⏰ Automated Daily Sync**: Automatically fetches your solved problems every day at 2 AM
- **🎨 Beautiful UI**: Modern, responsive dashboard with smooth animations
- **📱 Mobile Friendly**: Works great on desktop, tablet, and mobile devices

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- LeetCode account
- Your LeetCode session cookies (SESSION and CSRF_TOKEN)

## 🔑 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your LeetCode Cookies

To fetch your LeetCode data, you need to extract your session credentials:

**How to get your cookies:**

1. Go to https://leetcode.com and log in
2. Open Browser DevTools (F12 or Cmd+Shift+I)
3. Go to Application → Cookies → https://leetcode.com
4. Find and copy:
   - `LEETCODE_SESSION` cookie value
   - `csrftoken` cookie value

### 3. Create `.env` File

Create a `.env` file in the root directory:

```
LEETCODE_SESSION=your_session_cookie_here
CSRF_TOKEN=your_csrf_token_here
```

### 4. Run the Dashboard

```bash
npm start
```

The dashboard will be available at **http://localhost:3000**

## 📊 Dashboard Features

### Statistics Cards
- **Total Solved**: Number of problems you've solved
- **Easy/Medium/Hard**: Breakdown by difficulty
- **Avg Acceptance**: Average acceptance rate of all solved problems

### Charts
- **Difficulty Distribution**: Doughnut chart showing easy/medium/hard split
- **Top Topics**: Bar chart showing your top 8 problem topics

### Problems Table
- Sort and search through all your solved problems
- Filter by difficulty level
- Filter by topic
- View acceptance rates and problem details

### Manual Fetch
- Click "🔄 Fetch Now" to manually update your problems list anytime
- The dashboard will automatically fetch daily at 2:00 AM

## 📁 Project Structure

```
leetcode_export.js       # Original export script (now integrated into fetcherService.js)
server.js               # Express server with API endpoints
fetcherService.js       # Fetching logic + Cron scheduler
package.json            # Dependencies
.env                    # Your LeetCode credentials

public/
├── index.html          # Main dashboard page
├── css/
│   └── style.css      # Dashboard styling
└── js/
    └── dashboard.js    # Dashboard logic & interactivity

data.json              # Your problems data (auto-generated)
leetcode_solved.csv    # CSV export (auto-generated)
```

## 🔄 How the Scheduler Works

The dashboard automatically fetches your solved problems:
- **Time**: Every day at **2:00 AM**
- **What it does**: 
  - Fetches your latest solved problems from LeetCode
  - Updates `data.json` with fresh data
  - Generates `leetcode_solved.csv` for reference
  - All data is available in the dashboard

You can also manually fetch anytime by clicking "🔄 Fetch Now" button.

## 🛠️ API Endpoints

- `GET /` - Main dashboard page
- `GET /api/problems` - Get all solved problems
- `GET /api/analytics` - Get analytics (stats, difficulty breakdown, topics)
- `POST /api/fetch` - Manually trigger data fetch

## ⚙️ Customization

### Change Scheduler Time

Edit `fetcherService.js` line with the cron schedule:

```javascript
// Current: 0 2 * * * (Daily at 2 AM)
// Format: minute hour day month dayOfWeek
cron.schedule("0 2 * * *", async () => {
  // Your schedule here
});
```

### Change Category Filter

In `fetcherService.js`, change the `categorySlug`:

```javascript
categorySlug: "all-code-essentials", // Change this
```

Common options:
- `"all-code-essentials"` - LeetCode essentials
- `""` - All problems
- `"database"` - Database problems
- etc.

## 🐛 Troubleshooting

### "CSRF_TOKEN is not defined"
- Make sure your `.env` file has the correct variable names
- Restart the server: `npm start`

### "Blocked or invalid response"
- Your LeetCode session might have expired
- Get fresh cookies and update `.env`
- Try again

### No problems showing up
- Click "🔄 Fetch Now" to fetch your problems
- Check browser console for errors (F12)
- Verify your `.env` credentials are correct

### Scheduler not running
- Check if the server is still running
- Scheduler runs at 2 AM every day (check your timezone)
- You can click "Fetch Now" anytime to test

## 📈 Next Steps

The dashboard includes:
- ✅ Real-time problem fetching
- ✅ Multiple filter options
- ✅ Beautiful charts and analytics
- ✅ Automated daily syncing
- ✅ CSV export for backup

## 🤝 Support

If you encounter issues:
1. Check the browser console (F12 → Console)
2. Verify your `.env` credentials
3. Check server logs in the terminal
4. Make sure all dependencies are installed: `npm install`

## 📝 License

MIT
