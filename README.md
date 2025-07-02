# Mezink Playwright Automation

This tool automates the process of visiting and processing social media profile URLs (such as Instagram, TikTok, etc.) using Playwright and a Chrome extension.

## Features
- Reads profile URLs from an Excel file (`profile_links.xlsx`).
- Lets you select a Chrome user profile for browser automation.
- Loads the Mezink Chrome extension from a `.crx` file.
- Automates login checks and navigation for each profile URL.
- Logs successes and failures, saving results to a JSON file.

## Requirements
- Python 3.8+
- [Playwright](https://playwright.dev/python/) (`pip install playwright`)
- [pandas](https://pandas.pydata.org/) (`pip install pandas`)
- [7-Zip](https://www.7-zip.org/) (for unpacking the `.crx` extension)
- Mezink Chrome extension `.crx` file (place in the same directory as the script)
- `profile_links.xlsx` file with a column containing profile URLs

## Setup
1. Install dependencies:
   ```bash
   pip install playwright pandas
   playwright install
   ```
2. Ensure 7-Zip is installed and available in your system PATH.
3. Place your Mezink extension `.crx` file in the `Extension_automation` directory.
4. Place your `profile_links.xlsx` file in the same directory.

## Usage
Run the script:
```bash
python mezink_playwright.py
```
- Select the Chrome profile where the Mezink extension is installed when prompted.
- The script will process each profile URL, log results, and save a summary to `processing_results.json`.

## Notes
- The script does **not** use or require `railway_api.py`.
- Make sure your Chrome profiles and extension are set up before running. 