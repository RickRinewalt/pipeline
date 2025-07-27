# Shameless vibe-coding CI/CD pipeline

## pod + Claude Code + ruvnet/claude-flow + YOLO protocols
**Impatient and want to get started? Hit the [setup instructions](#setup-instructions) now!**

The main requirements in my search for an agentic coding setup are sustainability and reliability, I have to say this delivers. 

I'm making awesome progress with my projects, while paying a flat monthly fee for the best coding model available. I can rely on this system to give me the outcome I want without it losing the plot (much).

Thanks to Waylon for sharing your early discoveries!

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

## Setup instructions

### Environment guidelines
It is **highly recommended** to run claude code in an isolated environment, containers (pods) are perfect for this. These are two solid choices:

1. [**GitHub Codespaces**](https://github.com/features/codespaces) - A free cloud-based container service provided by Microsoft which is really easy to setup and use.
2. [**DevPod**](https://devpod.sh/) - A codespace-like environment which you can run anywhere. A bit more involved to setup but has certain advantages.
  
DevPod (the genericized version of Codespaces - see Side Note*) is currently my preferred setup, but this is not for everyone. It simply enables you to use your existing `devcontainer.json` spec in platforms beyond Codespaces—your laptop, local Docker, cloud, remote VM, Kubernetes cluster, etc. ([github.com][1], [loft.sh][2]).

### Claude Code setup
1. Subscribe to **Claude Code**.

### Option 1. Codespace setup

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

### Option 2. DevPod setup
- Feel free to follow the setup I've documented for my mac development environment [here](./mac_dev_setup).
- This includes automated setup of claude-flow and YOLO protocols, among other things.

## Examples
Typical prompts I use:
 
Research:
```
npx claude-flow@alpha swarm "Research topic X, use a 3 agent swarm for the task, only ever use the swarm to complete tasks. Follow YOLO WCP for task management, keep tasks and status up to date. Let's go!"
```

Technical options analysis:
```
npx claude-flow@alpha swarm "Based on research in issue X, expand on this with further research and technical options analysis. Explore a range of different approaches and variations, and provide your recommendations based on the following criteria: Y. Swarm it up, only ever use the swarm to complete tasks. Follow YOLO WCP for task management,
```

Specification and planning:
```
npx claude-flow@alpha swarm "Based on issue X, following your recommendations generate a detailed technical specification. Based on the specification, using YOLO WCP create an Epic, with linked Features, and sub-tasks for the entire project, and keep going and don't stop until all the planning is done. Go the swarm!"
```

Rapid development:
```
npx claude-flow@alpha swarm "Review all the open issues and crack on with deploying the project feature-by-feature, following the full YOLO protocols. When completing features, always follow CI/CD; branch, PR, merge if you can, sync, repeat. Keep going and don't stop! Good luck on your mission 🫡"
```

## Side Note on Codespaces vs DevPod 
* DevPod is built around the **open `devcontainer.json` standard**—the same standard used by both GitHub Codespaces and VS Code Remote Containers. It takes that configuration file and runs your environment anywhere: locally, in a cloud VM, over SSH, or even on Kubernetes ([github.com][1]).
* DevPod is an open‑source, provider‑agnostic implementation of the **devcontainer** standard.

In summary:
* **GitHub Codespaces** is a hosted service built around `devcontainer.json`.
* **DevPod** also uses `devcontainer.json`, but gives you full control over where and how they run—making it a flexible **alternative to relying on devcontainers being hosted in Codespaces**.

[1]: https://github.com/loft-sh/devpod?utm_source=chatgpt.com "loft-sh/devpod: Codespaces but open-source, client-only ... - GitHub"
[2]: https://www.loft.sh/blog/introducing-devpod-codespaces-but-open-source?utm_source=chatgpt.com "Introducing DevPod: Open Source Alternative to Codespaces - Loft.sh"
