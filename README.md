# Shameless vibe-coding CI/CD pipeline: pod + Claude Code + ruvnet/claude-flow + YOLO protocols
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
- Autonomous coding agent (npm package) - https://docs.anthropic.com/en/docs/claude-code/overview

## Setup instructions

### Environment guidelines
It is **highly recommended** to run claude code in an isolated environment, containers are perfect for this. These are two solid choices:

1. [**GitHub Codespaces**](https://github.com/features/codespaces) - A free cloud-based container service provided by Microsoft which is really easy to setup and use.
2. [**DevPod**](https://devpod.sh/) - A codespace-like environment which you can run anywhere. A bit more involved to setup but has certain advantages.
  
DevPod is currently my preferred setup, but this is not for everyone. I run this on my mac mini, I've documented the environment setup [here](./mac_dev_setup).

### Claude setup
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
