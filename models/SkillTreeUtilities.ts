import { SkillTreeData } from "./SkillTreeData";
import { SkillNode, SkillNodeStates } from "./SkillNode";
import { SkillTreeEvents } from "./SkillTreeEvents";
import * as PIXI from "pixi.js";
import { SkillTreeCodec } from "./url-processing/SkillTreeCodec";
import { ShortestPathAlgorithm } from "./algorithms/ShortestPathAlgorithm"
import { AllocateNodesAlgorithm } from "./algorithms/AllocateNodesAlgorithm"
import { ScienceAlgorithm } from "./algorithms/ScienceAlgorithm"

export class SkillTreeUtilities {
    private dragStart: PIXI.Point;
    private dragEnd: PIXI.Point;
    private DRAG_THRESHOLD_SQUARED = 5 * 5;
    private LONG_PRESS_THRESHOLD = 100;
    skillTreeData: SkillTreeData;
    skillTreeDataCompare: SkillTreeData | undefined;
    skillTreeCodec: SkillTreeCodec;
    
    //shortestPath: ShortestPathAlgorithm;
    //allocationAlgorithm: AllocateNodesAlgorithm;
    scienceAlgorithm: ScienceAlgorithm;

    constructor(context: SkillTreeData, contextComapre: SkillTreeData | undefined) {
        this.skillTreeData = context;
        this.skillTreeDataCompare = contextComapre;
        this.skillTreeCodec = new SkillTreeCodec();

        //this.shortestPath = new ShortestPathAlgorithm();
        //this.allocationAlgorithm = new AllocateNodesAlgorithm(this.skillTreeData);
        this.scienceAlgorithm = new ScienceAlgorithm(this.skillTreeData)

        SkillTreeEvents.on("node", "click", this.click);
        SkillTreeEvents.on("node", "rightclick", this.rightclick);
        SkillTreeEvents.on("node", "tap", this.click);
        SkillTreeEvents.on("node", "mouseover", this.mouseover);
        SkillTreeEvents.on("node", "mouseout", this.mouseout);
        SkillTreeEvents.on("node", "touchstart", this.touchstart);
        SkillTreeEvents.on("node", "touchend", this.touchend);
        SkillTreeEvents.on("node", "touchcancel", this.touchend);

        this.dragStart = new PIXI.Point(0, 0);
        this.dragEnd = new PIXI.Point(0, 0);
        SkillTreeEvents.on("viewport", "drag-start", (point: PIXI.IPoint) => this.dragStart = JSON.parse(JSON.stringify(point)));
        SkillTreeEvents.on("viewport", "drag-end", (point: PIXI.IPoint) => this.dragEnd = JSON.parse(JSON.stringify(point)));
        SkillTreeEvents.on("viewport", "mouseup", () => setTimeout(() => this.dragStart = JSON.parse(JSON.stringify(this.dragEnd)), 250));
        SkillTreeEvents.on("viewport", "touchend", () => setTimeout(() => this.dragStart = JSON.parse(JSON.stringify(this.dragEnd)), 250));
        SkillTreeEvents.on("viewport", "touchcancel", () => setTimeout(() => this.dragStart = JSON.parse(JSON.stringify(this.dragEnd)), 250));

        SkillTreeEvents.on("controls", "class-change", this.changeStartClass);
        SkillTreeEvents.on("controls", "ascendancy-class-change", this.changeAscendancyClass);
        SkillTreeEvents.on("controls", "search-change", this.searchChange);

        SkillTreeEvents.on("skilltree", "encode-url", () => window.location.hash = '#' + this.encodeURL(true));
    }

    private lastHash = "";
    public decodeURL = (allocated: boolean) => {
        if(window.location.hash === ""){
            this.changeStartClass(3, false);
        }
        if (this.lastHash === window.location.hash) {
            return;
        }
        this.lastHash = window.location.hash;

        try {
            const data = window.location.hash.replace("#", "");
            if (data === null) {
                window.location.hash = "";
                return;
            }

            const def = this.skillTreeCodec.decodeURL(data, this.skillTreeData, allocated);
            this.skillTreeData.version = def.Version;
            this.changeStartClass(def.Class, false);
            this.changeAscendancyClass(def.Ascendancy, false);
            for (const node of def.Nodes) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Active)
            }
            
            for (const node of def.ExtendedNodes) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Active)
            }

            for (const [node, effect] of def.MasteryEffects) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Active)
                this.skillTreeData.masteryEffects[node.skill] = effect;
            }
            
            for (const node of def.Desired) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }
            for (const node of def.Undesired) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.UnDesired)
            }
            window.location.hash = '#' + this.encodeURL(false);
        }
        catch (ex) {
            window.location.hash = "";
            console.log(ex);
        }
    }

    public encodeURL = (allocated: boolean) => {
        SkillTreeEvents.fire("skilltree", "active-nodes-update");
        SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
        this.broadcastSkillCounts();
        return `${this.skillTreeCodec.encodeURL(this.skillTreeData, allocated)}`;
    }

    private broadcastSkillCounts = () => {
        //need to add bandits here
        let maximumNormalPoints = this.skillTreeData.points.totalPoints;
        const maximumAscendancyPoints = this.skillTreeData.points.ascendancyPoints;
        let normalNodes = 0;
        let ascNodes = 0;

        const nodes = this.skillTreeData.getNodes(SkillNodeStates.Active);
        for (const id in nodes) {
            const node = nodes[id];
            if (node.classStartIndex === undefined && !node.isAscendancyStart) {
                if (node.ascendancyName === "") {
                    normalNodes++;
                } else {
                    ascNodes++;
                }
                maximumNormalPoints += node.grantedPassivePoints;
            }
        }

        SkillTreeEvents.fire("skilltree", "normal-node-count", normalNodes);
        SkillTreeEvents.fire("skilltree", "normal-node-count-maximum", maximumNormalPoints);
        SkillTreeEvents.fire("skilltree", "ascendancy-node-count", ascNodes);
        SkillTreeEvents.fire("skilltree", "ascendancy-node-count-maximum", maximumAscendancyPoints);
    }

    public changeStartClass = (start: number, encode = true) => {
        for (const id in this.skillTreeData.classStartNodes) {
            const node = this.skillTreeData.nodes[id];
            if (node.classStartIndex === undefined) {
                continue;
            }

            if (node.classStartIndex !== start) {
                this.skillTreeData.removeState(node, SkillNodeStates.Active);
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                continue;
            }

            this.skillTreeData.addState(node, SkillNodeStates.Active);
            this.skillTreeData.addState(node, SkillNodeStates.Desired);
            SkillTreeEvents.fire("skilltree", "class-change", node);
        }
        this.changeAscendancyClass(0, false, true);
        this.allocateNodes();

        if (encode) {
            window.location.hash = '#' + this.encodeURL(false);
        }        
    }

    public changeAscendancyClass = (start: number, encode = true, newStart = false) => {
        if(newStart) SkillTreeEvents.fire("skilltree", "ascendancy-class-change");
        if (this.skillTreeData.classes.length === 0) {
            return;
        }

        const ascClasses = this.skillTreeData.classes[this.skillTreeData.getStartClass()].ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        const ascClass = ascClasses[start];
        const name = ascClass !== undefined ? ascClass.name : undefined;

        for (const id in this.skillTreeData.ascedancyNodes) {
            const node = this.skillTreeData.nodes[id];
            if (node.ascendancyName !== name) {
                this.skillTreeData.removeState(node, SkillNodeStates.Active);
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                continue;
            }
            if (node.isAscendancyStart) {
                this.skillTreeData.addState(node, SkillNodeStates.Active);
                this.skillTreeData.addState(node, SkillNodeStates.Desired);
                SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
            }
        }

        if (encode) {
            window.location.hash = '#' + this.encodeURL(false);
        }
    }

    public searchChange = (str: string | undefined = undefined) => {
        this.skillTreeData.clearState(SkillNodeStates.Highlighted);

        if (str !== undefined && str.length !== 0) {
            const regex = new RegExp(str, "gi");
            for (const id in this.skillTreeData.nodes) {
                const node = this.skillTreeData.nodes[id];
                if (node.isAscendancyStart || node.classStartIndex !== undefined) {
                    continue;
                }
                if (node.name.match(regex) !== null || node.stats.find(stat => stat.match(regex) !== null) !== undefined) {
                    this.skillTreeData.addState(node, SkillNodeStates.Highlighted);
                }
            }
        }

        SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
    }

    private click = (node: SkillNode) => {
        //this.skillTreeData.clearState(SkillNodeStates.Highlighted)
        if (node.is(SkillNodeStates.Compared)) {
            return;
        }

        if ((this.dragStart.x - this.dragEnd.x) * (this.dragStart.x - this.dragEnd.x) > this.DRAG_THRESHOLD_SQUARED
            || (this.dragStart.y - this.dragEnd.y) * (this.dragStart.y - this.dragEnd.y) > this.DRAG_THRESHOLD_SQUARED) {
            return;
        }
        if (node.classStartIndex !== undefined || node.isAscendancyStart) {
            return;
        }

        if (node.classStartIndex !== undefined || node.isAscendancyStart) {
            return;
        }

        if(node.ascendancyName !== "" && Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).filter(node => node.isAscendancyStart)[0].ascendancyName !== node.ascendancyName){
            return
        }

        if (this.skillTreeData.tree === "Atlas" && node.isMastery) {
            let groups: Array<number> = []
            for (const id in this.skillTreeData.nodes) {
                const other = this.skillTreeData.nodes[id];
                if (!other.isMastery) {
                    continue;
                }

                if (other.name !== node.name) {
                    continue;
                }

                if (other.group === undefined) {
                    continue;
                }

                if(!groups.includes(other.group)){
                    groups.push(other.group)
                }
            }
            for(const groupId of groups){
                for(const nodeId of this.skillTreeData.groups[groupId].nodes){
                    const node = this.skillTreeData.nodes[nodeId]
                    if(node.isNotable){                        
                        if (node.is(SkillNodeStates.Desired)) {
                            this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                            this.skillTreeData.addState(node, SkillNodeStates.UnDesired);
                        }
                        else if (node.is(SkillNodeStates.UnDesired)){
                            this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
                        }
                        else if (!node.isMastery) {
                            this.skillTreeData.addState(node, SkillNodeStates.Desired);
                        }
                        SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
                    }
                }
            }
        }
        else{
            if (node.is(SkillNodeStates.Desired)) {
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                this.skillTreeData.addState(node, SkillNodeStates.UnDesired);
            }
            else if (node.is(SkillNodeStates.UnDesired)){
                this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
            }
            else {
                this.skillTreeData.addState(node, SkillNodeStates.Desired);
            }
            SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
        }
        
        
        this.allocateNodes();
    }

    private rightclick = (node: SkillNode) => {
        //this.skillTreeData.clearState(SkillNodeStates.Highlighted)
        if (this.skillTreeData.tree === "Atlas" && node.isMastery) {
            let groups: Array<number> = []
            for (const id in this.skillTreeData.nodes) {
                const other = this.skillTreeData.nodes[id];
                if (!other.isMastery) {
                    continue;
                }

                if (other.name !== node.name) {
                    continue;
                }

                if (other.group === undefined) {
                    continue;
                }

                if(!groups.includes(other.group)){
                    groups.push(other.group)
                }
            }
            for(const groupId of groups){
                for(const nodeId of this.skillTreeData.groups[groupId].nodes){
                    const node = this.skillTreeData.nodes[nodeId]
                    if(node.isNotable){                        
                        this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                        this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
                    }
                }
            }
        }
        else{
            this.skillTreeData.removeState(node, SkillNodeStates.Desired);
            this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
        }
        this.allocateNodes();
        SkillTreeEvents.fire("skilltree", "highlighted-nodes-update");
    }

    public allocateNodes = () => {
        console.time('Execution time')
        this.scienceAlgorithm.Execute();
        console.timeEnd('Execution time')

        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        window.location.hash = '#' + this.encodeURL(false);
    }

    private touchTimeout: Timer | null = null;
    private touchstart = (node: SkillNode) => {
        this.touchTimeout = setTimeout(() => this.dragEnd.x = this.dragStart.x + this.DRAG_THRESHOLD_SQUARED * this.DRAG_THRESHOLD_SQUARED, this.LONG_PRESS_THRESHOLD);
        this.mouseover(node);
    }

    private touchend = (node: SkillNode) => {
        if (this.touchTimeout !== null) {
            clearTimeout(this.touchTimeout);
        }
        this.mouseout(node);
    }

    private mouseover = (node: SkillNode) => {
        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);

        if (node.classStartIndex === undefined) {
            if (node.is(SkillNodeStates.Compared)) {
                this.skillTreeDataCompare?.addState(node, SkillNodeStates.Hovered);
            } else {
                this.skillTreeData.addState(node, SkillNodeStates.Hovered);

                if (this.skillTreeData.tree === "Atlas" && node.isMastery) {
                    for (const id in this.skillTreeData.nodes) {
                        const other = this.skillTreeData.nodes[id];
                        if (!other.isMastery) {
                            continue;
                        }

                        if (other.name !== node.name) {
                            continue;
                        }

                        this.skillTreeData.addState(other, SkillNodeStates.Hovered);
                    }
                }
            }
        }
        //console.log(this.adjustDesiredGroupDistances([node], 0.01))

        SkillTreeEvents.fire("skilltree", "hovered-nodes-start", node);
    }

    private mouseout = (node: SkillNode) => {
        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        SkillTreeEvents.fire("skilltree", "hovered-nodes-end", node);
    }
}
