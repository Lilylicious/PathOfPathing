import '../content/app.css';

import { SkillTreeData } from "../models/SkillTreeData";
import { SkillTreeEvents } from "../models/SkillTreeEvents";
import { ISkillTreeRenderer } from '../models/types/ISkillTreeRenderer';
import { PIXISkillTreeRenderer } from '../models/PIXISkillTreeRenderer';
import { SkillTreeUtilities } from '../models/SkillTreeUtilities';
import { ConnectionStyle, SkillNode, SkillNodeStates } from '../models/SkillNode';
import { utils } from './utils';
import { SkillTreePreprocessors } from '../models/skill-tree/SkillTreePreprocessors';
import { SemVer } from 'semver';
import internal from 'stream';
import { UIEvents } from 'models/events/UIEvents';

export class App {
    private skillTreeData!: SkillTreeData;
    private skillTreeDataCompare: SkillTreeData | undefined;
    private skillTreeUtilities!: SkillTreeUtilities;
    private renderer!: ISkillTreeRenderer;
    private uievents!: UIEvents

    public launch = async (version: string, versionCompare: string, versionJson: IVersions) => {
        for (const i of [version, versionCompare]) {
            if (i === '') {
                continue;
            }

            let options: ISkillTreeOptions | undefined = undefined;
            const semver = new SemVer(i);
            var file = await fetch(`${utils.SKILL_TREES_URI}/${i}/SkillTree.json`).then(response => response.json());
            var json = file as ISkillTreeBase;
            //this.SetupPregeneration(file)

            const data = new SkillTreeData(SkillTreePreprocessors.Decode(json, options), semver);

            if (i === version) {
                this.skillTreeData = data;
            }

            if (i === versionCompare) {
                this.skillTreeDataCompare = undefined;
            }
        }
        this.uievents = new UIEvents(this.skillTreeData, this.skillTreeDataCompare);
        this.skillTreeUtilities = new SkillTreeUtilities(this.skillTreeData, this.skillTreeDataCompare);

        const versionSelect = document.getElementById("skillTreeControl_Version") as HTMLSelectElement;
        for (const ver of versionJson.versions) {
            const v = document.createElement("option");
            v.text = v.value = ver;
            if (ver === version) {
                v.setAttribute('selected', 'selected');
            }
            versionSelect.appendChild(v);

            const c = document.createElement("option");
            c.text = c.value = ver;
            if (ver === versionCompare) {
                c.setAttribute('selected', 'selected');
            }
        }
        versionSelect.onchange = () => {
            const version = versionSelect.value !== '0' ? versionSelect.value : '';
            App.ChangeSkillTreeVersion(version, "", "");
        };

        const controls = document.getElementsByClassName("skillTreeVersions") as HTMLCollectionOf<HTMLDivElement>;
        for (const i in controls) {
            if (controls[i].style !== undefined) {
                controls[i].style.removeProperty('display');
            }
        }

        const reset = document.getElementById("skillTreeControl_Reset") as HTMLButtonElement;
        reset.addEventListener("click", () => {
            const start = this.skillTreeData.getStartClass();
            const asc = this.skillTreeData.getAscendancyClass();
            const wildwoodAsc = this.skillTreeData.getWildwoodAscendancyClass();

            const importControl = document.getElementById("skillTreeControl_Import") as HTMLInputElement

            importControl.value = ''

            this.skillTreeData.clearState(SkillNodeStates.Active);
            this.skillTreeData.clearState(SkillNodeStates.Desired);
            this.skillTreeData.clearState(SkillNodeStates.UnDesired);

            SkillTreeEvents.controls.fire("class-change", start);
            SkillTreeEvents.controls.fire("ascendancy-class-change", asc);
            SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
            SkillTreeEvents.controls.fire("wildwood-ascendancy-class-change", wildwoodAsc);
        });

        const exportElement = document.getElementById("skillTreeControl_Export") as HTMLButtonElement;
        exportElement.addEventListener("click", () => {
            const passiveCode = this.skillTreeUtilities.encodeURL(true)
            const prefix = 'https://www.pathofexile.com/fullscreen-' + (this.skillTreeData.tree.slice(0,5) === 'Atlas' ? 'atlas' : 'passive') + '-skill-tree/'
            const url = prefix + passiveCode
            navigator.clipboard.writeText(url);
        });

        const showhide = document.getElementById("skillTreeStats_ShowHide") as HTMLButtonElement;
        showhide.addEventListener("click", () => {
            const content = document.getElementById("skillTreeStats_Content") as HTMLDivElement;
            const stats = document.getElementById("skillTreeStats") as HTMLDivElement;
            if (content.toggleAttribute('hidden')) {
                stats.style.setProperty('height', 'fit-content');
                showhide.innerText = "Show";
            } else {
                stats.style.setProperty('height', `80%`);
                showhide.innerText = "Hide";
            }
        });
        
        const recalculate = document.getElementById('skillTreeControl_Recalculate') as HTMLInputElement;
        recalculate.addEventListener("click", () => {
            SkillTreeEvents.skill_tree.fire("recalculate", true);
        });

        const pause = document.getElementById('skillTreeControl_Pause') as HTMLInputElement;
        pause.addEventListener("click", () => {
            if (pause.innerText == "Pause Allocation") {
                pause.innerText = "Unpause Allocation";
                recalculate.style.setProperty('display', 'inline')
            } else {
                pause.innerText = "Pause Allocation";
                recalculate.style.setProperty('display', 'none')
            }
            SkillTreeEvents.controls.fire("pause-change");
        });

        

        const container = document.getElementById("skillTreeContainer");
        if (container !== null) {
            this.renderer = new PIXISkillTreeRenderer(container, this.skillTreeData, this.skillTreeDataCompare);
            this.renderer.Initialize()
                .then(() => {
                    this.SetupEventsAndControls();
                    this.renderer.RenderBase();
                    this.skillTreeUtilities.decodeURL(false);
                    this.skillTreeUtilities.allocateNodes(false);
                    this.renderer.RenderCharacterStartsActive();
                    this.renderer.RenderActive();
                })
                .catch((reason) => console.error(reason));
        }
    }

    private SetupPregeneration = (file) => {
        
        const sourceNodes = Object.values(file.nodes).map(node => node.skill);
        let destinationNodes = []

        // let sourceNodes = Object.values(file.nodes).filter(
        //     node => node.ascendancyName === undefined && node.group !== 0 
        //     && (node.isNotable === true || node.isKeystone === true) 
        //     && ((node.out !== undefined && node.out.length > 0) 
        //     || (node.in !== undefined && node.in.length > 0))).map(node => Number(node.skill));

        for (const nodeId of file.nodes.root.out){
            let actualNodes = []
            actualNodes.push(...file.nodes[nodeId].out)
            actualNodes.push(...file.nodes[nodeId].in)
            for (const secondNodeId of actualNodes) {
                let startNode = file.nodes[secondNodeId]
                if (startNode.isAscendancyStart === undefined){
                    destinationNodes.push(Number(secondNodeId))
                }
                    
            }
        }
        //const destinationNodes = sourceNodes;
        
        this.PreGenerateShortestDistances(file, sourceNodes, destinationNodes);
    }

    private PreGenerateShortestDistances = (file, sourceNodes, destinationNodes) => {
        let verbose = false
        
        const nodes = file.nodes
        console.log('Shortest distances started')
        for (const nodeId in nodes){
            file.nodes[nodeId].distance = {}
        }
        console.log('Reset done')

        let count = 0
        console.log('Checking ' + sourceNodes.length + '')
        console.log(destinationNodes)
        for (const sourceId of sourceNodes){   
            if (sourceId === "root"){
                console.log('Skipping root')
                continue;
            }

            if(sourceId === undefined || nodes[sourceId] === undefined){
                console.log('Skipping undefined node')
                continue;
            }
            
            // if(file.tree.slice(0,5) === 'Atlas' && nodes[sourceId].isMastery !== 'undefined'){
            //     console.log('Skipping mastery')
            //     continue;
            // }
            //const sourceId = 6
            if (file.tree.slice(0,5) !== 'Atlas' && nodes[sourceId].ascendancyName !== undefined){
                continue;
            }      

            //console.log('Skipping mastery')

            if((nodes[sourceId].out === undefined && nodes[sourceId].in === undefined)
            || (nodes[sourceId].out && nodes[sourceId].out.length === 0 && nodes[sourceId].in && nodes[sourceId].in.length === 0)){
                console.log('Skipping no out or in')
                continue;
            }

            // if(count > 100)
            //     break;

            let distance: { [id: string]: number } = {};
            distance[sourceId] = 0;
            const frontier: Array<SkillNode> = [nodes[sourceId]];
            const explored: { [id: string]: SkillNode } = {}
            while (frontier.length > 0) {
                const current = frontier.shift();
                if (current === undefined) {
                    continue;
                }
                if(sourceId === 65499 && current.skill === 5515){
                    console.log('verbose enabled')
                    verbose = true
                }
                
                //console.log('Checking', sourceId + ': ' + current.skill)
                explored[current.skill] = current;
                const dist = distance[current.skill];
                let actualNodes = []
                if(current.out)actualNodes.push(...current.out)
                if(current.in)actualNodes.push(...current.in)
                for (const id of actualNodes) {
                    const out = nodes[id];
                    if (out.ascendancyName !== "" && out.ascendancyName !== undefined) {
                        continue;
                    }
                    if (explored[id] || distance[id]) {
                        continue;
                    }

                    if(destinationNodes.includes(Number(id))){
                        file.nodes[sourceId].distance[id] = dist + 1;
                    }
    
                    count++
                    distance[id] = dist + 1;
                    frontier.push(out);
                }
            }
        }
        console.log('Total frontier checks: ' + count);

        var a = document.createElement("a");
        var newFile = new Blob([JSON.stringify(file, null, 4)], {type: 'text/plain'});
        a.href = URL.createObjectURL(newFile);
        a.download = 'UpdatedTree.json';
        a.click();
    }

    private SetupEventsAndControls = () => {
        SkillTreeEvents.skill_tree.on("highlighted-nodes-update", this.renderer.RenderHighlight);
        SkillTreeEvents.skill_tree.on("class-change", this.renderer.RenderCharacterStartsActive);
        SkillTreeEvents.skill_tree.on("class-change", this.updateClassControl);
        SkillTreeEvents.skill_tree.on("ascendancy-class-change", this.updateAscClassControl);
        SkillTreeEvents.skill_tree.on("wildwood-ascendancy-class-change", this.updateWildwoodAscClassControl);

        SkillTreeEvents.skill_tree.on("hovered-nodes-start", this.renderer.StartRenderHover);
        SkillTreeEvents.skill_tree.on("hovered-nodes-end", this.renderer.StopRenderHover);
        SkillTreeEvents.skill_tree.on("active-nodes-update", this.renderer.RenderActive);
        SkillTreeEvents.skill_tree.on("active-nodes-update", this.updateStats);

        SkillTreeEvents.skill_tree.on("normal-node-count", (count: number) => { const e = document.getElementById("skillTreeNormalNodeCount"); if (e !== null) e.innerHTML = count.toString(); });
        SkillTreeEvents.skill_tree.on("normal-node-count-maximum", (count: number) => { const e = document.getElementById("skillTreeNormalNodeCountMaximum"); if (e !== null) e.innerHTML = count.toString(); });
        SkillTreeEvents.skill_tree.on("ascendancy-node-count", (count: number) => { const e = document.getElementById("skillTreeAscendancyNodeCount"); if (e !== null) e.innerHTML = count.toString(); });
        SkillTreeEvents.skill_tree.on("ascendancy-node-count-maximum", (count: number) => { const e = document.getElementById("skillTreeAscendancyNodeCountMaximum"); if (e !== null) e.innerHTML = count.toString(); });
        SkillTreeEvents.skill_tree.on("wildwood-ascendancy-node-count", (count: number) => { const e = document.getElementById("skillTreeWildwoodAscendancyNodeCount"); if (e !== null) e.innerHTML = count.toString(); });
        SkillTreeEvents.skill_tree.on("wildwood-ascendancy-node-count-maximum", (count: number) => { const e = document.getElementById("skillTreeWildwoodAscendancyNodeCountMaximum"); if (e !== null) e.innerHTML = count.toString(); });

        this.populateStartClasses(document.getElementById("skillTreeControl_Class") as HTMLSelectElement);
        this.bindSearchBox(document.getElementById("skillTreeControl_Search") as HTMLInputElement);
        this.bindImportBox(document.getElementById("skillTreeControl_Import") as HTMLInputElement);
        
        const controls = document.getElementsByClassName("skillTreeControls") as HTMLCollectionOf<HTMLDivElement>;
        for (const i in controls) {
            if (controls[i].style !== undefined) {
                controls[i].style.removeProperty('display');
            }
        }

        const points = document.getElementsByClassName("skillTreePoints") as HTMLCollectionOf<HTMLDivElement>;
        for (const i in points) {
            if (points[i].style !== undefined) {
                points[i].style.removeProperty('display');
            }
        }
    }

    private masteries: string[] | undefined = undefined;
    private masteryTest: { [name: string]: string } | undefined = undefined;
    private defaultStats: { [stat: string]: boolean } | undefined = undefined;
    private buildStatLookups = (defaultGroup: string): [masteries: string[], masteryTest: { [name: string]: string }, defaultStats: { [stat: string]: boolean }] => {
        if (this.masteries === undefined || this.masteryTest === undefined) {
            const masteries: string[] = ["The Maven"];
            const masteryTest: { [name: string]: string } = { "The Maven": " Maven" }
            for (const id in this.skillTreeData.nodes) {
                const node = this.skillTreeData.nodes[id];
                const mastery = this.skillTreeData.getMasteryForGroup(node.nodeGroup);
                if (mastery !== null && mastery.name !== defaultGroup) {
                    masteries.push(mastery.name);
                    masteryTest[mastery.name] = mastery.name.replace("The", "").replace("Mastery", "")
                }
            }
            this.masteries = masteries;
            this.masteryTest = masteryTest;
        }

        if (this.defaultStats === undefined) {
            const defaultStats: { [stat: string]: boolean } = {};
            for (const id in this.skillTreeData.nodes) {
                const node = this.skillTreeData.nodes[id];
                for (const stat of node.stats) {
                    if (defaultStats[stat] !== undefined) {
                        continue
                    }

                    const mastery = this.skillTreeData.getMasteryForGroup(node.nodeGroup);
                    if (mastery === null) {
                        let found = false;
                        for (const name of this.masteries) {
                            if (stat.indexOf(this.masteryTest[name]) >= 0) {
                                found = true
                                break;
                            }
                        }

                        if (!found) {
                            defaultStats[stat] = true;
                        }
                    }
                }
            }
            this.defaultStats = defaultStats;
        }
        return [this.masteries, this.masteryTest, this.defaultStats];
    }

    private updateStats = () => {
        const defaultGroup = this.skillTreeData.tree.slice(0, 5) === "Atlas" ? "Maps" : "Default";
        const [masteries, masteryTest, defaultStats] = this.buildStatLookups(defaultGroup);

        const groups: { [group: string]: string[] } = {};
        const statGroup: { [stat: string]: string } = {};
        const stats: { [stat: string]: number } = {};
        const nodes = this.skillTreeData.getSkilledNodes();
        for (const id in nodes) {
            const node = nodes[id];
            for (const stat of node.stats) {
                if (stats[stat] === undefined) {
                    stats[stat] = 1;
                } else {
                    stats[stat] = stats[stat] + 1;
                }

                if (statGroup[stat] !== undefined) {
                    const group = statGroup[stat];
                    if (groups[group].indexOf(stat) === -1) {
                        groups[group].push(stat);
                    }
                    continue;
                }

                if (defaultStats[stat]) {
                    if (groups[defaultGroup] === undefined) {
                        groups[defaultGroup] = [];
                    }

                    if (groups[defaultGroup].indexOf(stat) === -1) {
                        statGroup[stat] = defaultGroup;
                        groups[defaultGroup].push(stat);
                    }
                    continue;
                }

                const mastery = this.skillTreeData.getMasteryForGroup(node.nodeGroup);
                if (mastery !== null) {
                    if (groups[mastery.name] === undefined) {
                        groups[mastery.name] = [];
                    }

                    if (groups[mastery.name].indexOf(stat) === -1) {
                        statGroup[stat] = mastery.name;
                        groups[mastery.name].push(stat);
                    }
                } else {
                    let group = defaultGroup;
                    for (const name of masteries) {
                        if (stat.indexOf(masteryTest[name]) >= 0) {
                            group = name;
                            break;
                        }
                    }

                    if (groups[group] === undefined) {
                        groups[group] = [];
                    }

                    if (groups[group].indexOf(stat) === -1) {
                        statGroup[stat] = group;
                        groups[group].push(stat);
                    }
                }
            }
        }

        const content = document.getElementById("skillTreeStats_Content") as HTMLDivElement;
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }

        for (const name of Object.keys(groups).sort((a, b) => a === defaultGroup ? -1 : (b === defaultGroup ? 1 : (a < b) ? -1 : 1))) {
            const groupStats: { [stat: string]: number } = {};
            for (const stat of groups[name]) {
                groupStats[stat] = stats[stat];
            }
            const div = this.createStatGroup(name, groupStats);
            content.appendChild(div);
        }
    }

    private createStatGroup = (name: string, stats: { [stat: string]: number }): HTMLDivElement => {
        const group = document.createElement("div");
        group.className = "group";

        const title = document.createElement("span");
        title.className = "title";
        title.innerText = name;
        title.addEventListener("click", () => {
            const elements = document.querySelectorAll(`[data-group-name="${name}"]`);
            elements.forEach((element) => {
                element.toggleAttribute("hidden");
            })
        });

        group.appendChild(title);

        for (const stat of Object.keys(stats).sort()) {
            const num = stats[stat];
            group.appendChild(this.createStat(name, `${num}x ${stat}`));
        }

        return group;
    }

    private createStat = (group: string, stat: string): HTMLDivElement => {
        const div = document.createElement("div");
        div.className = "stat";
        div.innerText = stat;
        div.setAttribute("data-group-name", group);
        return div;
    }

    private populateStartClasses = (classControl: HTMLSelectElement) => {
        while (classControl.firstChild) {
            classControl.removeChild(classControl.firstChild);
        }

        const options = new Array<HTMLOptionElement>();
        for (const id in this.skillTreeData.classStartNodes) {
            const classId = this.skillTreeData.nodes[id].classStartIndex;
            if (classId === undefined) {
                continue;
            }
            const e = document.createElement("option");
            e.text = this.skillTreeData.root.out.length === 1 ? "Atlas" : this.skillTreeData.constants.classIdToName[classId];
            e.value = classId.toString();

            if (classId === this.skillTreeData.getStartClass()) {
                e.setAttribute("selected", "selected");
            }
            options.push(e);
        }

        options.sort((a, b) => {
            const first = a.value;
            const second = b.value;
            if (first !== null && second !== null) {
                return +first - +second;
            }
            return 0;
        });

        for (const e of options) {
            classControl.append(e);
        }

        const ascControl = document.getElementById("skillTreeControl_Ascendancy") as HTMLSelectElement;
        if (ascControl !== null) {
            this.populateAscendancyClasses(ascControl);
        }

        const wildwoodAscControl = document.getElementById("skillTreeControl_WildwoodAscendancy") as HTMLSelectElement;
        if (wildwoodAscControl !== null) {
            this.populateWildwoodAscendancyClasses(wildwoodAscControl);
        }

        classControl.onchange = () => {
            const val = classControl.value;
            SkillTreeEvents.controls.fire("class-change", +val);
            if (ascControl !== null) {
                this.populateAscendancyClasses(ascControl, +val, 0);
            }
            if (wildwoodAscControl !== null) {
                this.populateWildwoodAscendancyClasses(wildwoodAscControl, 0)
            }
        };
    }

    private updateClassControl = () => {
        const start = this.skillTreeData.getStartClass();
        (document.getElementById("skillTreeControl_Class") as HTMLSelectElement).value = String(start);
    }

    private updateAscClassControl = () => {
        if (this.skillTreeData.classes.length === 0) {
            return;
        }
        
        const start = this.skillTreeData.getAscendancyClass();
        const ascClasses = this.skillTreeData.classes[this.skillTreeData.getStartClass()].ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        const ascControl = (document.getElementById("skillTreeControl_Ascendancy") as HTMLSelectElement);
        this.createAscendancyClassOptions(ascControl, ascClasses, start);
    }

    private populateAscendancyClasses = (ascControl: HTMLSelectElement, start: number | undefined = undefined, startasc: number | undefined = undefined) => {
        while (ascControl.firstChild) {
            ascControl.removeChild(ascControl.firstChild);
        }

        if (this.skillTreeData.classes.length === 0) {
            ascControl.style.display = "none";
            const e = document.getElementById("skillTreeAscendancy") as HTMLDivElement;
            if (e !== null) e.style.display = "none";
            return;
        }

        const startClass = start !== undefined ? start : this.skillTreeData.getStartClass();
        const ascClasses = this.skillTreeData.classes[startClass].ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        const ascStart = startasc !== undefined ? startasc : this.skillTreeData.getAscendancyClass();
        this.createAscendancyClassOptions(ascControl, ascClasses, ascStart);

        ascControl.onchange = () => {
            SkillTreeEvents.controls.fire("ascendancy-class-change", +ascControl.value);
        };
    }

    private updateWildwoodAscClassControl = () => {
        if (this.skillTreeData.alternate_ascendancies.length === 0) {
            return;
        }

        const start = this.skillTreeData.getWildwoodAscendancyClass();
        const ascClasses = this.skillTreeData.alternate_ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        const ascControl = (document.getElementById("skillTreeControl_WildwoodAscendancy") as HTMLSelectElement);
        this.createAscendancyClassOptions(ascControl, ascClasses, start);
    }

    private populateWildwoodAscendancyClasses = (ascControl: HTMLSelectElement, startasc: number | undefined = undefined) => {
        while (ascControl.firstChild) {
            ascControl.removeChild(ascControl.firstChild);
        }

        if (this.skillTreeData.alternate_ascendancies.length === 0) {
            ascControl.style.display = "none";
            const e = document.getElementById("skillTreeWildwoodAscendancy") as HTMLDivElement;
            if (e !== null) e.style.display = "none";
            return;
        }

        const ascClasses = this.skillTreeData.alternate_ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        const ascStart = startasc !== undefined ? startasc : this.skillTreeData.getAscendancyClass();
        this.createAscendancyClassOptions(ascControl, ascClasses, ascStart);

        ascControl.onchange = () => {
            SkillTreeEvents.controls.fire("wildwood-ascendancy-class-change", +ascControl.value);
        };
    }

    private createAscendancyClassOptions = (control: HTMLSelectElement, classes: IAscendancyClassV7[], start: number) => {
        while (control.firstChild) {
            control.removeChild(control.firstChild);
        }

        const none = document.createElement("option");
        none.text = "None";
        none.value = "0";
        if (start === 0) {
            none.setAttribute("selected", "selected");
        }
        control.append(none);

        if (classes.length === 0) {
            return
        }

        for (const id in classes) {
            const asc = classes[id];
            const value = +id + 1;

            const e = document.createElement("option");
            e.text = asc.id;
            e.value = `${value}`;

            if (value === start) {
                e.setAttribute("selected", "selected");
            }
            control.append(e);
        }
    }

    private searchTimout: Timer | null = null;
    private bindSearchBox = (searchControl: HTMLInputElement) => {
        searchControl.onkeyup = () => {
            if (this.searchTimout !== null) {
                clearTimeout(this.searchTimout);
            }
            this.searchTimout = setTimeout(() => {
                SkillTreeEvents.controls.fire("search-change", searchControl.value);
                this.searchTimout = null;
            }, 250);
        };
    }

    private bindImportBox = (importControl: HTMLInputElement) => {
        importControl.onpaste = (event: ClipboardEvent) => {
            SkillTreeEvents.controls.fire("import-change", event.clipboardData?.getData('text'));
        };
        importControl.onclick = () => {
            importControl.select();
        }
    }

    public static decodeURLParams = (search = ''): { [id: string]: string } => {
        const hashes = search.slice(search.indexOf("?") + 1).split("&");
        return hashes.reduce((params, hash) => {
            const split = hash.indexOf("=");

            if (split < 0) {
                return Object.assign(params, {
                    [hash]: null
                });
            }

            const key = hash.slice(0, split);
            const val = hash.slice(split + 1);

            return Object.assign(params, { [key]: decodeURIComponent(val) });
        }, {});
    };

    public static ChangeSkillTreeVersion = (version: string, compare: string, hash: string) => {
        let search = '?';
        if (version !== '') {
            search += `v=${version}`;
        }

        if (!search.endsWith('?') && compare !== '') search += '&';

        if (compare !== '') {
            search += `c=${compare}`;
        }

        if (window.location.hash !== hash) {
            window.location.hash = hash;
        }

        if (window.location.search !== search) {
            window.location.search = search;
        }
        
        const classControl = document.getElementById("skillTreeControl_Class") as HTMLSelectElement
        if(version.slice(-5) === 'atlas' || version.slice(-8) === 'standard' ){
            classControl.style.visibility = 'hidden'
        } else {
            classControl.style.visibility = 'visible'
        }
    }
}
