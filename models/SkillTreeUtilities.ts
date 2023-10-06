import { SkillTreeData } from "./SkillTreeData";
import { SkillNode, SkillNodeStates } from "./SkillNode";
import { SkillTreeEvents } from "./SkillTreeEvents";
import * as PIXI from "pixi.js";
import { SkillTreeCodec } from "./SkillTreeCodec";
import { sleep } from "bun";

export class SkillTreeUtilities {
    private dragStart: PIXI.Point;
    private dragEnd: PIXI.Point;
    private DRAG_THRESHOLD_SQUARED = 5 * 5;
    private LONG_PRESS_THRESHOLD = 100;
    skillTreeData: SkillTreeData;
    skillTreeDataCompare: SkillTreeData | undefined;
    skillTreeCodec: SkillTreeCodec;

    constructor(context: SkillTreeData, contextComapre: SkillTreeData | undefined) {
        this.skillTreeData = context;
        this.skillTreeDataCompare = contextComapre;
        this.skillTreeCodec = new SkillTreeCodec();

        SkillTreeEvents.on("node", "click", this.click);
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

        SkillTreeEvents.on("skilltree", "encode-url", this.encodeURL);
    }

    private lastHash = "";
    public decodeURL = () => {
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

            const def = this.skillTreeCodec.decodeURL(data, this.skillTreeData);
            this.skillTreeData.version = def.Version;
            this.skillTreeData.fullscreen = def.Fullscreen;
            this.changeStartClass(def.Class, false);
            this.changeAscendancyClass(def.Ascendancy, false);
            for (const node of def.Nodes) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Active)
            }

            for (const id in this.skillTreeData.classStartNodes) {
                if (this.skillTreeData.nodes[id].is(SkillNodeStates.Active)) {
                    const refund = this.getRefundNodes(this.skillTreeData.nodes[id]);
                    for (const i of refund) {
                        this.skillTreeData.removeState(i, SkillNodeStates.Active);
                    }
                }
            }

            this.encodeURL();
        }
        catch (ex) {
            window.location.hash = "";
            console.log(ex);
        }
    }

    private encodeURL = () => {
        SkillTreeEvents.fire("skilltree", "active-nodes-update");
        this.broadcastSkillCounts();
        window.location.hash = `#${this.skillTreeCodec.encodeURL(this.skillTreeData)}`;
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
                continue;
            }

            this.skillTreeData.addState(node, SkillNodeStates.Active);
            SkillTreeEvents.fire("skilltree", "class-change", node);
            for (const i of this.getRefundNodes(node)) {
                this.skillTreeData.removeState(i, SkillNodeStates.Active);
            }
        }
        this.skillTreeData.clearState(SkillNodeStates.Desired);
        this.changeAscendancyClass(0, false);

        if (encode) {
            this.encodeURL();
        }
    }

    public changeAscendancyClass = (start: number, encode = true) => {
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
                continue;
            }
            if (node.isAscendancyStart) {
                this.skillTreeData.addState(node, SkillNodeStates.Active);
                SkillTreeEvents.fire("skilltree", "ascendancy-class-change", node);
            }
        }

        if (encode) {
            this.encodeURL();
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
        const previousActiveNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).filter(node => node.classStartIndex === undefined && node.ascendancyName === "")

        for (const node of previousActiveNodes){
            this.skillTreeData.removeState(node, SkillNodeStates.Active);
        }
        
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
        const startNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
        .filter(node => node.classStartIndex !== undefined)[0].out
        .filter(nodeId => this.skillTreeData.nodes[nodeId].isAscendancyStart === false)
        .map(nodeId => this.skillTreeData.nodes[nodeId]);
        let desiredNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired)).sort((a,b) => {
            let distanceA = 100
            let distanceB = 100

            for(const node of startNodes){
                const startId = node.GetId();
                const aId = a.GetId();
                const bId = b.GetId();
                const smallerIdA = aId < startId ? aId : startId;
                const biggerIdA = aId < startId ? startId : aId;
                const smallerIdB = bId < startId ? bId : startId;
                const biggerIdB = bId < startId ? startId : bId;
                const distA = this.skillTreeData.nodes[smallerIdA].distance[biggerIdA]
                const distB = this.skillTreeData.nodes[smallerIdB].distance[biggerIdB]

                if(distA === undefined || distB === undefined)
                    return -1

                distanceA = distA < distanceA ? distA : distanceA;
                distanceB = distB < distanceB ? distB : distanceB;
            }
                 
            if(distanceA < distanceB)    
                return -1
            if(distanceA > distanceB)
                return 1

            return 0
        });

        const firstNode = desiredNodes[0];
        if(firstNode !== undefined){
            //this.skillTreeData.addState(firstNode, SkillNodeStates.Active);
            if(desiredNodes.length === 1 && !startNodes.includes(desiredNodes[0])){
                const desiredNodeId = desiredNodes[0].GetId()
                let startNode;
                let startNodeDistance = 1000;
                for (const node of startNodes){
                    const nodeId = node.GetId()

                    const smallerId = desiredNodeId < nodeId ? desiredNodeId : nodeId;
                    const biggerId = desiredNodeId < nodeId ? nodeId : desiredNodeId;
                    const dist = this.skillTreeData.nodes[smallerId].distance[biggerId]

                    if(dist < startNodeDistance){
                        startNode = node;
                        startNodeDistance = dist;
                    }
                }

                
                if(startNode === undefined){
                    startNode = this.getShortestPath(firstNode, false)[0]
                }

                if (!startNode.is(SkillNodeStates.Active)) {
                    this.skillTreeData.addState(startNode, SkillNodeStates.Active);
                }
            }
            let count = 0
            while (desiredNodes.length > 0){
                if(++count > 50){
                    console.log('Breaking due to desiredNodes not going down', desiredNodes.length)
                    break;
                }

                const paths: Array<{ id: string, path: Array<SkillNode> }> = [];
                for(const node of desiredNodes){
                    const id = node.GetId();
                    const path = this.getShortestPath(node, true);
                    paths.push({id, path})
                }
                if(paths.length == 0)
                    break;
                paths.sort((a,b) => a.path.length - b.path.length)
                const shortestPath = paths.shift()
                if (shortestPath === undefined)
                    return;
                const shortestPathNode = this.skillTreeData.nodes[shortestPath.id]
                if (shortestPath.path.length > 0 || shortestPathNode.is(SkillNodeStates.Active)) {
                    if (!shortestPathNode.is(SkillNodeStates.Active)) {
                        this.skillTreeData.addState(shortestPathNode, SkillNodeStates.Active);
                    }
                    
                    for (const i of shortestPath.path) {
                        if (!i.is(SkillNodeStates.Active)) {
                            this.skillTreeData.addState(i, SkillNodeStates.Active);
                        }
                    }

                    
                    desiredNodes = desiredNodes.filter(node => !node.is(SkillNodeStates.Active))
                }
            }
        }

        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        this.encodeURL();
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
        const shortest = this.getShortestPath(node, false);
        for (const i of shortest) {
            if (!i.is(SkillNodeStates.Pathing) && !i.is(SkillNodeStates.Active)) {
                this.skillTreeData.addState(i, SkillNodeStates.Pathing);
            }
        }
        node.hoverText = shortest.length.toString();

        if (shortest.length > 0 || node.is(SkillNodeStates.Active)) {
            const refund = this.getRefundNodes(node);
            for (const i of refund) {
                this.skillTreeData.addState(i, SkillNodeStates.Pathing);
            }
            if (refund.length > 0) {
                node.hoverText = refund.length.toString();
            }
        }

        SkillTreeEvents.fire("skilltree", "hovered-nodes-start", node);
    }

    private mouseout = (node: SkillNode) => {
        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        SkillTreeEvents.fire("skilltree", "hovered-nodes-end", node);
    }

    private getShortestPath = (target: SkillNode, wantDebug: boolean): Array<SkillNode> => {
        wantDebug = wantDebug && target.id === '5616'
        if (target.is(SkillNodeStates.Active)){
            if(wantDebug) console.log('Early return 1')
            return new Array<SkillNode>;
        }
        if (target.isBlighted) {
            if(wantDebug) console.log('Early return 2')
            return new Array<SkillNode>(target);
        }
        let foundNode: SkillNode = target;
        const startNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
        .filter(node => node.classStartIndex !== undefined)[0].out
        .filter(nodeId => this.skillTreeData.nodes[nodeId].isAscendancyStart === false)
        .map(nodeId => this.skillTreeData.nodes[nodeId]);

        const frontier: Array<SkillNode> = [];
        const distance: { [id: string]: number } = {};
        const adjacent = this.getAdjacentNodes([target.GetId()]);
        for (const id in adjacent) {
            const node = adjacent[id];
            if (node.isAscendancyStart && !node.is(SkillNodeStates.Active)) {
                continue;
            }
            if (node.is(SkillNodeStates.UnDesired) || node.classStartIndex !== undefined){
                continue;
            }
            frontier.push(adjacent[id]);
            distance[id] = 1;
        }
        if(wantDebug) console.log(startNodes)


        const explored: { [id: string]: SkillNode } = {};
        explored[target.GetId()] = target;
        const prev: { [id: string]: SkillNode } = {};
        while (frontier.length > 0) {
            const current2 = frontier.shift();
            if (current2 === undefined) {
                if(wantDebug) console.log('Early return 3')
                break;
            }
            if(wantDebug) console.log('Current frontier ID', current2.GetId())

            explored[current2.GetId()] = current2;
            const dist = distance[current2.GetId()];
            let count = 0
            for (const id of current2.out) {
                if(++count > 20) break;
                if(wantDebug) console.log('Current out ID', id)
                const out = this.skillTreeData.nodes[id];
                if ((current2.ascendancyName === "" && out.ascendancyName !== "" && !out.is(SkillNodeStates.Active))
                    || (current2.ascendancyName !== "" && out.ascendancyName === "" && !current2.is(SkillNodeStates.Active))) {
                    continue;
                }
                if (explored[id] || distance[id]) {
                    continue;
                }
                if (out.isAscendancyStart && !out.is(SkillNodeStates.Active)) {
                    continue;
                }
                
                if (out.is(SkillNodeStates.UnDesired) || out.classStartIndex !== undefined) {
                    continue;
                }
                
                if(wantDebug) console.log('Adding out node to frontier')
                distance[id] = dist + 1;
                prev[id] = current2;
                frontier.push(out);
                if(wantDebug) console.log('New frontier', frontier.map(node => node.GetId()))
                if(wantDebug) console.log('Is out active?', out.is(SkillNodeStates.Active))
                if (out.is(SkillNodeStates.Active) || startNodes.map(node => node.id).includes(out.id)) {
                    frontier.length = 0;
                    foundNode = out;
                    break;
                }
            }
        }

        if(wantDebug) console.log('Found node', foundNode, foundNode === target, distance[foundNode.GetId()])
        if (foundNode === target || distance[foundNode.GetId()] === undefined) {
            return new Array<SkillNode>();
        }
        let current: SkillNode | undefined = foundNode;
        const path = new Array<SkillNode>();
        while (current !== undefined) {
            path.push(current);
            current = prev[current.GetId()];
        }
        return path.reverse();
    }

    private getRefundNodes = (source: SkillNode): Array<SkillNode> => {
        let characterStartNode: SkillNode | undefined = undefined;
        for (const id in this.skillTreeData.classStartNodes) {
            const node = this.skillTreeData.nodes[id];
            if (node.is(SkillNodeStates.Active) && node.classStartIndex !== undefined) {
                characterStartNode = node;
            }
        }
        if (characterStartNode === undefined) {
            return new Array<SkillNode>();
        }

        let frontier = new Array<SkillNode>();
        const reachable: { [id: string]: SkillNode } = {};
        for (const id of characterStartNode.out) {
            const out = this.skillTreeData.nodes[id];
            if (out.ascendancyName !== "" && source.ascendancyName !== "" && out.ascendancyName !== source.ascendancyName) {
                continue;
            }
            if (out.is(SkillNodeStates.Active) && out.GetId() !== source.GetId()) {
                frontier.push(out);
                reachable[id] = out;
            }
        }
        while (frontier.length > 0) {
            const nextFrontier = new Array<SkillNode>();
            for (const node of frontier) {
                for (const id of node.out) {
                    const out = this.skillTreeData.nodes[id];
                    if (out.isMultipleChoiceOption && source.isMultipleChoiceOption) {
                        const outchoice = out.in.find(id => this.skillTreeData.nodes[id].isMultipleChoice);
                        if (outchoice !== undefined && outchoice === source.in.find(id => this.skillTreeData.nodes[id].isMultipleChoice)) {
                            continue;
                        }
                    }
                    if (out.ascendancyName !== "" && source.ascendancyName !== "" && out.ascendancyName !== source.ascendancyName) {
                        continue;
                    }
                    if (out.GetId() === source.GetId() || reachable[id] || !out.is(SkillNodeStates.Active)) {
                        continue;
                    }

                    nextFrontier.push(out);
                    reachable[id] = out;
                }
            }

            frontier = nextFrontier;
        }

        const unreachable = new Array<SkillNode>();
        const skilledNodes = this.skillTreeData.getSkilledNodes();
        for (const id in skilledNodes) {
            if (/*reachable[id] === undefined && */this.skillTreeData.nodes[id].classStartIndex === undefined) {
                unreachable.push(this.skillTreeData.nodes[id]);
            }
        }
        return unreachable;
    }

    private getAdjacentNodes = (nodeIds: Array<string>) => {
        const adjacentNodes: { [id: string]: SkillNode } = {};
        for (const parentId of nodeIds) {
            for (const id of this.skillTreeData.nodes[parentId].out) {
                const out = this.skillTreeData.nodes[id];
                if (out.classStartIndex !== undefined && !out.is(SkillNodeStates.Active)) {
                    continue;
                }
                adjacentNodes[id] = out;
            }
        }
        return adjacentNodes;
    }
}