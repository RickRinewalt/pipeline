# Shameless vibe-coding CI/CD pipeline - Vanilla Claude Code version
**Impatient and want to get started? Hit the [setup instructions](#setup-instructions) now!**

The main requirements in my search for an agentic coding setup are sustainability and reliability, I have to say this delivers. 

I'm making awesome progress with my projects, while paying a flat monthly fee for the best coding model available. I can rely on this system to give me the outcome I want without it losing the plot (much).

Thanks to Waylon for sharing your discoveries!

## Who this is for
If you are just wanting something easy to help you prototype an idea then you might be better off with https://v0.dev/ or https://lovable.dev/. 

If you dont mind getting a little technical and are looking for something a bit more robust, then this is the way.

## Components
### Visual Studio Code (VS Code)
- Our code editor - https://code.visualstudio.com/

### GitHub
- Code repository - https://github.com/

### GitHub Codespace
- Cloud container based IDE - https://code.visualstudio.com/docs/remote/codespaces

### Claude Code
- Autonomous coding agent (npm package) - https://docs.anthropic.com/en/docs/claude-code/overviewhttps://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline

### Netlify
- CI/CD deployment target. Hosts our website, provides continuous deployment on code commit - https://www.netlify.com/

## Setup instructions
1. Subscribe to **Claude Code**.
2. Create a repo in GitHub, tick the box that creates a **README.md**
3. Install **VS Code**.
4. You need a development environment. Easiest way is to start with a codespace.
    * On the welcome screen of VS Code, select the option for **Connect to**, then select **Create New Codespace**.
    * If you are not already authenticated to GitHub you should be prompted to do that.
    * Now select the repo you just created from the drop-down. The codespace will spin up and clone the remote repo to the codespace.
5. Now install **Claude Code** in the codespace inside VS Code, by following the *Getting started in 30 seconds* instructions: https://docs.anthropic.com/en/docs/claude-code/overview
    * You run the commands from within the Terminal, which is accessible under **View / Terminal**.
    * Now you're basically running. Just ask Claude Code to do stuff.
6. You will need to get familiar and comfortable with working with source control, committing changes to git and syncing to your remote repo on GitHub.
