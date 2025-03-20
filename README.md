# Shameless vibe-coding CI/CD pipeline
High-level details of the current development pipeline I'm using. Expect this to evolve as tweaks and improvements are made.

**Impatient and want to get started? Hit the [setup instructions](#setup-instructions) now!**

The main requirements in my search for an agentic coding setup are sustainability and reliability, I have to say this delivers. 

I'm making awesome progress with my projects, while paying a flat monthly fee for the best coding model available. I can rely on this system to give me the outcome I want without it losing the plot (much).

Thanks to Waylon for sharing your discoveries!

## Who this is for
If you are just wanting something easy to help you prototype an idea then you might be better off with https://v0.dev/ or https://lovable.dev/. 

If you dont mind getting a little technical and are looking for something a bit more robust, then this is the way.

## Component diagram
```mermaid
graph TB
    subgraph AI [AI Agent Components]
        direction TB
        roo["Roo Code (VS Code Extension)"]
        crct["Cline Recursive Chain of Thought System"]
        vscode_lmapi[VS Code Language Model API]
        github_copilot[GitHub Copilot Pro]
        sonnet["Anthropic Claude Sonnet 3.5 (LLM)"]
        other_model["Any other LLM provided by GitHub Copilot"]
    end

    subgraph DEV [Development Environment]
        direction TB
        vscode[Visual Studio Code]
        codespace[GitHub Codespace]
        github["GitHub Repository"]
        netlify["Netlify (CI/CD Deployment)"]
    end

    sonnet --> |Generate code| github_copilot
    other_model --> |Generate code| github_copilot
    github_copilot --> |LLM service layer| vscode_lmapi
    vscode_lmapi --> |Intermediate Copilot LLMs| roo
    crct --> |Facilitate memory| roo
    roo --> |Vibe coding| codespace

    vscode --> |Develop/run code| codespace
    codespace --> |Push Code| github
    github --> |Triggers Build| netlify

```

## Components
### Visual Studio Code (VS Code)
- Our code editor - https://code.visualstudio.com/

### GitHub
- Code repository - https://github.com/

### GitHub Codespace
- Cloud-based IDE - https://code.visualstudio.com/docs/remote/codespaces

### Roo Code
- Autonomous coding agent (visual studio code extension) - https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline

### Cline Recursive Chain of Thought System
- System prompt for roo, essentially "memory" providing dynamic context for code changes - https://github.com/RPG-fan/Cline-Recursive-Chain-of-Thought-System-CRCT-

### VS Code Language Model API With Roo Code
- This API allows extensions to provide access to language models directly within VS Code. This is our method to use models from GitHub Copilot - https://docs.roocode.com/providers/vscode-lm

### Github Copilot Pro
- Monthly subscription providing access to a range of language models - https://github.com/features/copilot/plans?cft=copilot_li.features_copilot

### Anthropic Claude Sonnet 3.5
- Coding model of choice. Running through Github Copilot Pro - https://claude.ai/

### Netlify
- CI/CD deployment target. Hosts our website, provides continuous deployment on code commit - https://www.netlify.com/

## Setup instructions
1. Subscribe to **GitHub Copilot Pro**.
2. Install **VS Code**.
3. While in VS Code, sign in to **GitHub Copilot**.
4. Now create a **New Codespace**.
5. Ensure GitHub Copilot and GitHub Copilot Chat **extensions** are installed in the Codespace.
6. Now install **Roo Code** extention in the same Codespace.
7. Configure the **API Provider** in the **Settings** for Roo Code - be patient, it takes a few moments for the **Language Model selector** to appear...

![image](https://github.com/cgbarlow/pipeline/blob/main/vscode_lmapi_providers.png)

8. Follow the instructions to setup the **Cline Recursive Chain-of-Thought System** provided in the documentation.
9. Where it refers to the step to **Set Up Cline Extension**, the associated steps in Roo (as a fork of Cline) are similar:
    * In the **Prompts** menu for Roo Code, update the **Custom Instructions for All Modes** to use the custom instructions provided.
10. Your setup is complete! You're ready to start vibe coding, either:
    * Copy an existing project into **src/** and run these commands:
        * *Perform initial setup and populate dependency trackers*
        * *Review the current state and suggest next steps*
    * Or for a brand new project, feed in your requirements and get building!
