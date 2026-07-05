Want to build your own Earthborne Rangers mod? This is how you do it! No coding experience is required, but (until Sunberry Keeper finishes the graphical version of the tools) it helps if you're already comfortable with using the terminal on your computer.

This guide covers building or customizing your campaign guide and packaging your mod for others to download. If you want to make custom cards, you'll need the [Strange Eons](https://cgjennings.ca/eons/) plugin. (Check the Earthborne Gamers discord server for instructions on using it.) You can include custom-made cards in your mod package, but creating them is outside the scope of this guide.

## What you'll need

All of these tools are free and lightweight.

- **[Obsidian](https://obsidian.md)** - to write and view your mod.
- **[NodeJS](https://nodejs.org/en/download)** - to run the mod tools. (scroll down to the button that gives you the installer).
- **[Git](https://git-scm.com)** - to track your changes.
- **[GitHub](https://github.com) account** - where your mod lives online.

## Step 1: Install the tools

1. Install Obsidian, Node.js, and Git using the links above. Use the default settings for each installer.
2. Create an account on GitHub, if you don't already have one.
3. Open a terminal (on Windows: search for "Terminal" in the Start menu; on Mac: open Terminal from Applications > Utilities).
4. Install the EBR mod tools in any folder you like (use the `cd` command to change folders):

```
git clone https://github.com/Earthborne-Rangers-Community-Mods/ebr-mod-tools.git
cd ebr-mod-tools
npm install
npm link
```

This downloads the mod tools to your machine, installs their dependencies, and makes the `ebr` command available globally on your system.

4. Verify it worked:

```
ebr --version
```

You should see a version number. If you get an error, close and reopen your terminal, then try again.

## Step 2: Set up the mod tools

Run the setup command and follow its prompts:

```
ebr setup
```

The first time you run it, if you've never used `git` before, a GitHub sign-in window may open (use the account you created earlier). Then setup helps you with:

1. **Confirming your GitHub account** - setup detects your GitHub username from that sign-in and asks you to confirm it. This is the GitHub account you'll use to back up and publish your mods.
2. **Forking the base mod and registry projects** - a *fork* is your own personal copy of a project on GitHub. Setup automatically creates two forks for you which are used by the tools to help you create and publish your mods.
3. **Deciding author details** - decide what you'll use as your public author name and discord account (optional) for your mods.

You only have to run this command once!

## Step 3: Create your mod

In terminal, navigate to the folder where you want your mod to live, then run:

```
ebr new
```

The tool asks you a series of questions about your mod (you can change your answers later by modifing a file):

- **Name** - what players will see in the mod list
- **Type** - what kind of mod you're making (see Mod Types below)
- **Description** - a sentence or two about what your mod does
- **Campaigns** - which official campaign(s) (if any) your mod modifies (eg. Lure of the Valley, Legacy of the Ancestors, etc.)
- **Products** - which products are required to play your mod, or optional (supported by your mod but not needed)

After answering, the tool creates a folder with your mod's starting files, ready to open in Obsidian (the next step).

### Mod types

| Type | What it is | Examples |
|---|---|---|
| **Enhancement** | Focused changes to existing campaign content - story improvements, balance tweaks, QoL fixes, new mechanics. Primarily *changes* existing content. | "Familiar Ground" shortens location descriptions on your second visit. "Romanceable NPCs" adds a romance arc for 4 NPCs. |
| **Expansion** | New content that significantly extends a campaign - new locations, mission chains, or gameplay systems. Mostly *adds* new content to an existing campaign. | Official expansions like "Spire in Bloom" and "Shadow of the Storm" work like this. |
| **One-Day Mission** | A single-session mission designed to be played in one sitting. Reuses an existing campaign (usually Lure of the Valley) as a base. | "Animal Rescue", "Missing Person", and "Predatory Instincts" are all official one-day missions found on the Living Valley. |
| **Campaign** | An entire custom campaign built from scratch. May reuse official cards, maps, etc, but has its own fully-custom campaign guide. | "Fire and Oath" is a prequel campaign to Lure of the Valley set in the Northern half of the Valley. "Of Wind and Wave" is a fully custom campaign that takes place on and around the Messipian Sea. |
| **Collection** | Multiple mods merged together into a single experience. | "LotV Unofficial Patch" combines several lore-friendly quality-of-life enhancement mods for the Lure of the Valley campaign together. "Ultimate Valley Experience" combines 5 fan-made expansions together, doubling the size of the base campaign. |
| **Theme** | Mod that reskins the Obsidian play experience. No content changes. | "Sci-fi Campaign Guide" makes the campaign guides feel like you're reading off a futuristic tablet. |

Pick the type that best matches your intent. If you're unsure, **enhancement** is the most common starting point - it lets you modify existing content without building a whole campaign from scratch.

## Step 4: Edit in Obsidian

If you open the folder the tool created, you'll see, among other things:

- **`.git`, `.github`, `.obsidian`, `.gitattributes`,`.gitignore`** - a bunch of files used by various tools. You should leave these alone.
- **`ebr-mod.json`** - your mod's metadata that you set up with `ebr new`. Feel free to edit it by hand if you want, but be careful not to mess up the format.
- **`About this Mod.md`** - the description page players see when browsing. Edit this in Obsidian to describe your mod, but don't change its name.
- **Content folders** - depending on your selections while running `ebr new`, you may find some content already blocked in for you.

Open the mod folder in Obsidian. (If you already use Obsidian for other things, there's a drop-down with a Manage Vaults button in the bottom right). This is where you'll edit your mod contents. Most of them are [markdown](https://www.markdownguide.org/basic-syntax/) files. You can use `[[wikilinks]]` to link from one page to another. To type special characters, you can use symbol spans in your content:

```html
<span class="progress"></span>  <!-- progress marker -->
<span class="harm"></span>       <!-- harm marker -->
<span class="sun"></span>        <!-- sun symbol -->
<span class="mountain"></span>   <!-- mountain symbol -->
<span class="crest"></span>      <!-- crest symbol -->
```

You can press the little pencil button in the top right corner of Obsidian's editing pane to switch from "editing mode" to "reading mode", making it look even better.

Feel free to drop images or pdfs directly into folders in Obsidian; these will get included for players as well when you package up your mod.

## Step 5: Save your work

Whenever you finish a chunk of work and want to back up your files, run:

```
ebr save
```

This asks for a short description of what you've changed, and backs everything up to your fork on GitHub. You should run this as often as you like!

## Step 6: Publish to the registry

When your mod is ready for players to find:

```
ebr publish
```

This creates a listing in the mod registry and opens a "pull request" (a request for the maintainers to review and add your mod) on GitHub. Once a maintainer approves it, your mod appears in the mod manager for everyone to install!

## Command reference

| Command | What it does |
|---|---|
| `ebr setup` | One-time GitHub and mod tools setup |
| `ebr new` | Create a new mod |
| `ebr save` | Save and back up your changes |
| `ebr publish` | Submit your mod to the registry |
| `ebr include` | Pull in a campaign's full content for modifying |
| `ebr update` | Check for updates to included content |
| `ebr scaffold` | Add blank template files to your mod for an official map or cards |

Run any command with `--help` to see its full usage and options (e.g. `ebr new --help`).
