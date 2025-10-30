# PathofPathing
This project is unlikely to get any major updates from me. Feel free to fork it, or do pull requests which I may or may not review.

The project is built on top of [EmmittJ's Skilltree Typescript](https://github.com/EmmittJ/SkillTree_TypeScript/) repository. All credit goes to them for the foundation!

## Current known issues:
* Poor performance on some devices/browsers. Try enabling hardware acceleration if it's disabled, or use a different browser to see if performance improves.

* Some paths are not quite optimal. I haven't seen a tree with more than one or two points more than needed, but there may be edge cases for this. This is extremely difficult to solve perfectly, give your trees a look-over to see if there's a few points that can be improved after you've made it.

## Abandoned future plans:

* Add the ability to optionally define node weights, with predefined ones in some cases, that affect what tree it considers optimal. For example, prioritizing traveling through life nodes when the paths are equal length.

* Expand on the ability for the tree to allocate groups of desired nodes. As an example, add a way to allocate life nodes within N nodes distance, or allocate all gateways when selecting seventh gate, or map drops when allocating wandering path perhaps.

## Update process when a new league launches
1) From the scripts directory, run `fetchGithubTrees.py`
2) From the root directory, run `bun run dev` to build the new version and start it in localhost
3) Confirm everything looks right, then push to master. Done.

I run this in WSL. If I was maintaining this properly I'd change this so the python script can be run from the same directory as building/running it, and combining the python script with building, but this is in full minimum-effort maintenance mode at the moment.

As long as no major changes are made, this should work fine. It handles the primary player skill tree, the primary atlas tree, and any league atlas tree if one exists. It does this by looking for the version number in the format currently in use (e.g. 3.27), and the filenames currently in use. If any of these change, then it will not longer automatically work to grab them. 

It does not handle ruthless or alternate trees, and there's no current plan to add support for it.

## FAQ:

* Mobile support?

Probably not.

* PoE2?

Probably not, too much work for how much I want to put into this going forward.

* Will this become part of Path of Building? 

Short answer, no. 

Longer answer, the atlas tree portion will definitely not be part of Path of Building. The regular passive tree portion may at some point get some kind of implementation in Path of Building, but there are no plans in the short term to create this functionality. If it does make it into Path of Building, it would be an opt-in alternative way of allocating nodes, it would likely not be enabled by default.

## Quick guide:
Click a node once to make it desired, twice to make it undesired, and three times total to bring you back to neutral.

## Contact info
The primary (and only) maintainer's username on discord is lilylicious, and on Reddit it's Lilyliciously.
