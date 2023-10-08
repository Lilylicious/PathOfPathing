# PathofPathing
This readme is going to get updated later, but a few important notes:

The project is built on top of [EmmittJ's Skilltree Typescript](https://github.com/EmmittJ/SkillTree_TypeScript/) repository. All credit goes to them for the foundation!

## Current known issues:
* Poor performance on some devices/browsers. Try enabling hardware acceleration if it's disabled, or use a different browser to see if performance improves.

* Some paths are not quite optimal. I haven't seen a tree with more than one or two points more than needed, but there may be edge cases for this. This is extremely difficult to solve perfectly, give your trees a look-over to see if there's a few points that can be improved after you've made it.

* Masteries in the main passive tree are not yet supported.

## Future plans:
* Add a help section with instructions to help new users figure out how to use the tool

* Add the ability to optionally define node weights, with predefined ones in some cases, that affect what tree it considers optimal. For example, prioritizing traveling through life nodes when the paths are equal length.

* Expand on the ability for the tree to allocate groups of desired nodes. As an example, add a way to allocate life nodes within N nodes distance, or allocate all gateways when selecting seventh gate, or map drops when allocating wandering path perhaps.

## FAQ:

* Mobile support?

Probably not.

* Will this become part of Path of Building? 

Short answer, no. 

Longer answer, the atlas tree portion will definitely not be part of Path of Building. The regular passive tree portion may at some point get some kind of implementation in Path of Building, but there are no plans in the short term to create this functionality. If it does make it into Path of Building, it would be an opt-in alternative way of allocating nodes, it would likely not be enabled by default.

## Quick guide:
Click a node once to make it desired, twice to make it undesired, and three times total to bring you back to neutral.

## Contact info
The primary (and only) maintainer's username on discord is lilylicious, and on Reddit it's Lilyliciously.
