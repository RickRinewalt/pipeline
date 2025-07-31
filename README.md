# Shameless vibe-coding CI/CD pipeline

## pod + Claude Code + ruvnet/claude-flow + YOLO protocols
**Impatient and want to get started? Hit the [setup instructions](#setup-instructions) now!**

![YOLO!](https://media.tenor.com/qUbWFRNgCQQAAAAM/han-solo-star-wars.gif)

The main requirements in my search for an agentic coding setup are sustainability and reliability, I have to say this delivers. 

I'm making awesome progress with my projects, while paying a flat monthly fee for the best coding model available. I can rely on this system to give me the outcome I want without it losing the plot (much).

Thanks to: 
- Waylon Kenning for sharing the discoveries on your agentic journey and unwavering encouragement
- rUv and the Agentics Foundation for the tools and amazing community
- Ravi Shamihoke for your energy and support!
- Marc Vincent for the useful Claude-flow usage guide

## Who this is for
If you are just wanting something easy to help you prototype an idea then you might be better off with https://v0.dev/ or https://lovable.dev/. 

If you dont mind getting a little technical and are looking for something a bit more robust, then this is the way.

## Common Components
### Visual Studio Code (VS Code)
- Our code editor - https://code.visualstudio.com/

### GitHub
- Code repository - https://github.com/

### Claude Code
- Autonomous coding agent (npm package) - https://docs.anthropic.com/en/docs/claude-code/overview

### ruvnet/claude-flow
- Swarm-coding orchestration incorporating SPARC methodology (among other things) - https://github.com/ruvnet/claude-flow/

### YOLO protocols (CLAUDE.md customisations)
- Standard workflow protocols for things like github issue creation for effective work tracking when using swarms, agile work chunking, and automated CI/CD process -  https://github.com/cgbarlow/pipeline/blob/main/claude.md_customisations/yolo_protocols.md

### (Optional) Continuous Deployment service (e.g. Netlify, Vercel)
- Both Netlify and Vercel are cloud platforms that automatically deploy and host web applications from your code repository with built-in features like continuous deployment, serverless functions, and global CDN distribution.
- What does Continuous Deployment mean? Put simply, once it's all setup properly, whenever you commit some changes to your repo Netlify/Vercel will magically pick up on the change and deploy it to your site, automatically!
    See:
    - https://www.netlify.com (my personal preference - simply because it was the first one I tried and it worked for me)
    - https://vercel.com

## Setup instructions

### Environment guidelines
It is **highly recommended** to run claude code in an isolated environment, containers (pods) are perfect for this. These are two solid choices:

1. [**GitHub Codespaces**](https://github.com/features/codespaces) - A free cloud-based container service provided by Microsoft which is really easy to setup and use.
2. [**DevPod**](https://devpod.sh/) - A codespace-like environment which you can run anywhere. A bit more involved to setup but has certain advantages.
  
DevPod (the genericized version of Codespaces - see Side Note[*](#side-note-on-codespaces-vs-devpod)) is currently my preferred setup, but this is not for everyone. It simply enables you to use your existing `devcontainer.json` spec in platforms beyond Codespaces—your laptop, local Docker, cloud, remote VM, Kubernetes cluster, etc. ([github.com][1], [loft.sh][2]).

#### Side Note on Codespaces vs DevPod 
* DevPod is built around the **open `devcontainer.json` standard**—the same standard used by both GitHub Codespaces and VS Code Remote Containers. It takes that configuration file and runs your environment anywhere: locally, in a cloud VM, over SSH, or even on Kubernetes ([github.com][1]).
* DevPod is an open‑source, provider‑agnostic implementation of the **devcontainer** standard.

In summary:
* **GitHub Codespaces** is a hosted service built around `devcontainer.json`.
* **DevPod** also uses `devcontainer.json`, but gives you full control over where and how they run—making it a flexible **alternative to relying on devcontainers being hosted in Codespaces**.

[1]: https://github.com/loft-sh/devpod?utm_source=chatgpt.com "loft-sh/devpod: Codespaces but open-source, client-only ... - GitHub"
[2]: https://www.loft.sh/blog/introducing-devpod-codespaces-but-open-source?utm_source=chatgpt.com "Introducing DevPod: Open Source Alternative to Codespaces - Loft.sh"

Ok. *Ready?*

![Let's go!YOLO](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTF2dTdmcG5qNTZqYWZ2Mjd6d2V3bHE3ZmRhMGxkd2xoZ3lpaDQ3ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aMh59aKR8vjdC/giphy.gif)

***Let's gooooo!***

### Claude Code setup
1. Subscribe to **Claude Code**.

### Environment setup
#### Option 1. Codespace

1. Create a repo in GitHub, tick the box that creates a **README.md**
2. Install **VS Code**.
3. You need a development environment. Easiest way is to start with a codespace.
    * On the welcome screen of VS Code, select the option for **Connect to**, then select **Create New Codespace**.
    * If you are not already authenticated to GitHub you should be prompted to do that.
    * Now select the repo you just created from the drop-down. The codespace will spin up and clone the remote repo to the codespace.
4. Now install **Claude Code** in the codespace inside VS Code, by following the *Getting started in 30 seconds* instructions: https://docs.anthropic.com/en/docs/claude-code/overview
    * You run the commands from within the Terminal, which is accessible under **View / Terminal**.
    * Now you're basically running. Just ask Claude Code to do stuff.
5. You will need to get familiar and comfortable with working with source control, committing changes to git and syncing to your remote repo on GitHub.
6. **ruvnet/claude-flow**:
    - Follow initial setup instructions here: https://github.com/ruvnet/claude-flow/
7. **YOLO protocols**:
    - Append contents of `yolo_protocols.md` to your `CLAUDE.md`.
    - Usage: YOLO protocols are carried out on request (read the file for details), protocols currently include:
      - Work Chunking Protocol (WCP)
      - Continuous Integration
      - Continuous Deployment
8. **Github CLI authentication**:
      - Generate a PAT in GitHub for the specific repo you're working with, ask Claude how to do this if you're not sure how.
      - Run claude, and prompt: authenticate to github CLI with the following PAT: then paste it in.

#### Option 2. DevPod
- Feel free to follow the setup I've documented for my mac development environment [here](./mac_dev_setup).
- This includes automated setup of claude-flow and YOLO protocols, among other things.

### (Optional) Continuous Deployment setup
- When you're ready to deploy, set up a **Netlify** account, and **import an existing project**.

    ![image](https://github.com/cgbarlow/pipeline/blob/main/netlify.png)

- Select **GitHub** and enter your repo.
- Once Netlify is setup, whenever you commit/sync to this repo in your Codespace, this will trigger a build in Netlify.
- If you have the same experience as me, you may experience some build errors in Netlify. I managed to fix this by pasting in the error messages back into Roo and we worked through the problem until the build process is successful.

## Usage 
Check out this [helpful guide to using claude-flow](./claude-flow-usage-guide.md) (thanks, Marc!)

### Quick examples
Typical prompts I use:
 
🔍 **Research:**
```bash
npx claude-flow@alpha swarm "Research topic X, use a 3 agent swarm for the task, only ever use the swarm to complete tasks. Follow YOLO WCP for task management, keep tasks and status up to date. Let's go!"

```

⚙️ **Technical options analysis:**
```bash
npx claude-flow@alpha swarm "Based on research in issue X, expand on this with further research and technical options analysis. Explore a range of different approaches and variations, and provide your recommendations based on the following criteria: Y. Swarm it up, only ever use the swarm to complete tasks. Follow YOLO WCP for task management

```

📝 **Specification and planning:**
```bash
npx claude-flow@alpha swarm "Based on issue X, following your recommendations generate a detailed technical specification. Based on the specification, using YOLO WCP create an Epic, with linked Features, and sub-tasks for the entire project, and keep going and don't stop until all the planning is done. Go the swarm!"

```

⚡ **Rapid development:**
```bash
npx claude-flow@alpha swarm "Review all the open issues and crack on with deploying the project feature-by-feature, following the full YOLO protocols. When completing features, always follow CI/CD; branch, PR, merge if you can, sync, repeat. Keep going and don't stop! Good luck on your mission 🫡"

```

## Contributing
Feel free to add any requests or feedback by creating a new **Issue**. If you would like to contribute directly, PRs will be happily considered 🙏
