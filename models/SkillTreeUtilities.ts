import { SkillTreeData } from "./SkillTreeData";
import { SkillNode, SkillNodeStates } from "./SkillNode";
import { SkillTreeEvents } from "./SkillTreeEvents";
import { SkillTreeCodec } from "./url-processing/SkillTreeCodec";
import { ShortestPathAlgorithm } from "./algorithms/ShortestPathAlgorithm"
import { AllocateNodesAlgorithm } from "./algorithms/AllocateNodesAlgorithm"

export class SkillTreeUtilities {
    skillTreeData: SkillTreeData;
    skillTreeDataCompare: SkillTreeData | undefined;
    skillTreeCodec: SkillTreeCodec;
    
    shortestPath: ShortestPathAlgorithm;
    allocationAlgorithm: AllocateNodesAlgorithm;

    constructor(context: SkillTreeData, contextComapre: SkillTreeData | undefined) {
        this.skillTreeData = context;
        this.skillTreeDataCompare = contextComapre;
        this.skillTreeCodec = new SkillTreeCodec();

        this.shortestPath = new ShortestPathAlgorithm();
        this.allocationAlgorithm = new AllocateNodesAlgorithm(this.skillTreeData);

        SkillTreeEvents.node.on("click", this.click);
        SkillTreeEvents.node.on("in", this.mouseover);
        SkillTreeEvents.node.on("out", this.mouseout);
        SkillTreeEvents.node.on("rightclick", this.rightclick);

        SkillTreeEvents.controls.on("class-change", this.changeStartClass);
        SkillTreeEvents.controls.on("ascendancy-class-change", this.changeAscendancyClass);
        SkillTreeEvents.controls.on("wildwood-ascendancy-class-change", this.changeWildwoodAscendancyClass);
        SkillTreeEvents.controls.on("search-change", this.searchChange);

        SkillTreeEvents.controls.on("import-change", this.importChange);
        SkillTreeEvents.skill_tree.on("encode-url", this.encodeURL);
    }

    private decodeImport = (str: string | undefined = undefined) => {
        if(str === undefined) return;
        const withoutDomain = str.replace('https://www.pathofexile.com/', '')
        const withoutTreeType = withoutDomain.replace('fullscreen-', '').replace('passive-skill-tree/', '').replace('atlas-skill-tree/', '')
        
        const regex = /\d\.\d\d\.\d\//g
        const withoutVersion = withoutTreeType.replace(regex, '')
        
        const regex2 = /\?accountName.*/g
        const data = withoutVersion.replace(regex2, '')
        try {
            if (data === null) {
                return;
            }

            const def = this.skillTreeCodec.decodeURL(data, this.skillTreeData, true);
            this.skillTreeData.version = def.Version;
            this.changeStartClass(def.Class, false);
            this.changeAscendancyClass(def.Ascendancy - 1, false);
            const nodesToDisable = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired))
            for (const node of nodesToDisable){
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
            }


            let rootNode = Object.values(this.skillTreeData.getClassStartNodes())[0]

            for (const id in this.skillTreeData.classStartNodes) {
                const node = this.skillTreeData.nodes[id];
                if (node.classStartIndex === undefined) {
                    continue;
                }
    
                if (node.classStartIndex !== def.Class) {
                    continue;
                }
    
                rootNode = node
            }

            if(rootNode === undefined){
                return
            }
            const nodesToFind = def.Nodes.map(node => node.skill);
            const nodesFound: Number[] = []

            let adjacent = [...new Set([...rootNode.out, ...rootNode.in])].map(nodeString => Number(nodeString))
            adjacent = adjacent.filter(nodeId => nodesToFind.includes(nodeId) && !nodesFound.includes(nodeId))
            while(adjacent.length > 0){
                const nextNode = adjacent.shift();
                if(nextNode === undefined){
                    break;
                }
                nodesFound.push(nextNode)
                const node = this.skillTreeData.nodes[String(nextNode)]
                adjacent.push(...[...new Set([...node.out, ...node.in])].map(nodeString => Number(nodeString)).filter(newNode => nodesToFind.includes(newNode) && !nodesFound.includes(newNode)))
            }

            for (const node of def.Nodes) {
                if(!nodesFound.includes(node.skill)) continue;
                if(node.isNotable || node.isKeystone || node.isJewelSocket || node.isAscendancyStart || node.classStartIndex !== undefined)
                    this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }
            
            for (const node of def.ExtendedNodes) {
                if(!nodesFound.includes(node.skill)) continue;
                if(node.isNotable || node.isKeystone || node.isJewelSocket || node.isAscendancyStart || node.classStartIndex !== undefined)
                    this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }

            for (const [node, effect] of def.MasteryEffects) {
                if(!nodesFound.includes(node.skill)) continue;
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
                this.skillTreeData.masteryEffects[node.skill] = effect;
            }
            
            for (const node of def.Desired) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }
            for (const node of def.Undesired) {
                this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.UnDesired)
            }
            window.location.hash = '#' + this.encodeURL(false);

            this.allocateNodes();
        }
        catch (ex) {
            //window.location.hash = "";
            console.log(ex);
        }
    }

    private lastHash = "";
    public decodeURL = (allocated: boolean) => {
        if(window.location.hash === ""){
            this.changeStartClass(this.skillTreeData.getDefaultStartNode(), false);
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
            this.changeWildwoodAscendancyClass(def.WildwoodAscendancy, false);

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
        SkillTreeEvents.skill_tree.fire("active-nodes-update");
        SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
        this.broadcastSkillCounts();
        return `${this.skillTreeCodec.encodeURL(this.skillTreeData, allocated)}`;
    }

    private broadcastSkillCounts = () => {
        //need to add bandits here
        let maximumNormalPoints = this.skillTreeData.points.totalPoints;
        const maximumAscendancyPoints = this.skillTreeData.points.ascendancyPoints;
        let normalNodes = 0;
        let ascNodes = 0;
        let wildwoodAscNodes = 0;

        const nodes = this.skillTreeData.getNodes(SkillNodeStates.Active);
        for (const id in nodes) {
            const node = nodes[id];
            if (node.classStartIndex === undefined && !node.isAscendancyStart && !node.isMultipleChoice) {
                if (node.ascendancyName === "") {
                    normalNodes++;
                } else {
                    if (this.skillTreeData.isWildwoodAscendancyClass(node)) {
                        wildwoodAscNodes++;
                    } else {
                        ascNodes++;
                    }
                                     
                }
                maximumNormalPoints += node.grantedPassivePoints;
            }
        }

        SkillTreeEvents.skill_tree.fire("normal-node-count", normalNodes);
        SkillTreeEvents.skill_tree.fire("normal-node-count-maximum", maximumNormalPoints);
        SkillTreeEvents.skill_tree.fire("ascendancy-node-count", ascNodes);
        SkillTreeEvents.skill_tree.fire("ascendancy-node-count-maximum", maximumAscendancyPoints);
        SkillTreeEvents.skill_tree.fire("wildwood-ascendancy-node-count", wildwoodAscNodes);
        SkillTreeEvents.skill_tree.fire("wildwood-ascendancy-node-count-maximum", maximumAscendancyPoints);
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
            SkillTreeEvents.skill_tree.fire("class-change", node);
        }
        this.changeAscendancyClass(0, false, true);
        this.changeWildwoodAscendancyClass(0, false, true);
        this.allocateNodes();

        if (encode) {
            window.location.hash = '#' + this.encodeURL(false);
        }        
    }

    public changeAscendancyClass = (start: number, encode = true, newStart = false) => {
        if (newStart) SkillTreeEvents.skill_tree.fire("ascendancy-class-change");
        if (this.skillTreeData.classes.length === 0) {
            return;
        }

        const ascClasses = this.skillTreeData.classes[this.skillTreeData.getStartClass()].ascendancies;
        if (ascClasses === undefined) {
            return;
        }
        this.changeAscendancyClassInternal(false, start, ascClasses, encode);
    }

    public changeWildwoodAscendancyClass = (start: number, encode = true, newStart = false) => {
        if (newStart) SkillTreeEvents.skill_tree.fire("wildwood-ascendancy-class-change");
        if (this.skillTreeData.alternate_ascendancies.length === 0) {
            return;
        }

        const ascClasses = this.skillTreeData.alternate_ascendancies;
        if (ascClasses === undefined) {
            return;
        }

        this.changeAscendancyClassInternal(true, start, ascClasses, encode);
    }

    private changeAscendancyClassInternal = (isWildwood: boolean, start: number, ascClasses: IAscendancyClassV7[], encode: boolean) => {
        const ascClass = ascClasses[start - 1];
        const name = ascClass !== undefined ? ascClass.id : undefined;

        for (const id in this.skillTreeData.ascendancyNodes) {
            const node = this.skillTreeData.nodes[id];
            if (this.skillTreeData.isWildwoodAscendancyClass(node) !== isWildwood) {
                continue;
            }

            if (node.ascendancyName !== name) {
                this.skillTreeData.removeState(node, SkillNodeStates.Active);
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                continue;
            }

            if (node.isAscendancyStart) {
                this.skillTreeData.addState(node, SkillNodeStates.Active);
                this.skillTreeData.addState(node, SkillNodeStates.Desired);
                SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
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

        SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
    }

    private importChange = (str: string | undefined = undefined) => {
        this.decodeImport(str)
    }

    private wanderingPathButtonClick = () => {
        let connectedMaps = 0;
        for(const node of Object.values(this.skillTreeData.nodes)){
            if(!node.is(SkillNodeStates.UnDesired) && !node.is(SkillNodeStates.Desired) && !node.isNotable && !node.isKeystone){
                for(const stat of node.stats){
                    if(connectedMaps < 100 && stat.indexOf('additional connected Map') !== -1){
                        connectedMaps += 4;
                        this.skillTreeData.addState(node, SkillNodeStates.Desired)
                    }
                    if(stat.indexOf('increased Quantity of Items found in your Maps') !== -1){
                        this.skillTreeData.addState(node, SkillNodeStates.Desired)
                    }
                    if(stat.indexOf('increased effect of Modifiers on your Non-Unique Maps') !== -1){
                        this.skillTreeData.addState(node, SkillNodeStates.Desired)
                    }
                }
            }
        }
    }
    private seventhGateClick = (rightclick: boolean, seventhGateNode: SkillNode) => {
        const nodes = Object.values(this.skillTreeData.nodes).filter(filterNode => filterNode.isWormhole)

        if(rightclick){
            for(const node of nodes){
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
            }
            return;
        }

        for(const node of nodes){
            if (seventhGateNode.is(SkillNodeStates.Desired)) {
                this.skillTreeData.removeState(node, SkillNodeStates.Desired);
                this.skillTreeData.addState(node, SkillNodeStates.UnDesired);
                
            }
            else if (seventhGateNode.is(SkillNodeStates.UnDesired)){
                this.skillTreeData.removeState(node, SkillNodeStates.UnDesired);
            }
            else {
                this.skillTreeData.addState(node, SkillNodeStates.Desired);
            }
        }
    }


    private click = (node: SkillNode) => {
        //this.skillTreeData.clearState(SkillNodeStates.Highlighted)
        if (node.is(SkillNodeStates.Compared)) {
            return;
        }

        if (node.classStartIndex !== undefined || node.isAscendancyStart) {
            return;
        }

        if (node.classStartIndex !== undefined || node.isAscendancyStart) {
            return;
        }

        const ascendancyStartNode = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
        .filter(node => node.isAscendancyStart)
        .filter(newNode => this.skillTreeData.isWildwoodAscendancyClass(node) == this.skillTreeData.isWildwoodAscendancyClass(newNode))
        [0]

        if(node.ascendancyName !== "" && ascendancyStartNode.ascendancyName !== node.ascendancyName){
            return
        }

        //// Wandering path isn't as obvious what nodes you want. I'd want some sort of user selection of desired stats in order to provide this automation.
        // if (this.skillTreeData.tree === "Atlas" && node.id === '40658' && !node.is(SkillNodeStates.Desired)){
        //    this.wanderingPathButtonClick()
        // }

        if (this.skillTreeData.tree === "Atlas" && node.id === '41153'){
            this.seventhGateClick(false, node);
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
                let nodes = [...this.skillTreeData.groups[groupId].nodes]
                if (groupId === 25) nodes.push('54499', '55003')
                if (groupId === 127) nodes.push('9338','50203','5515')
                for(const nodeId of nodes){
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
                        SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
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
            SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
        }
        
        
        this.allocateNodes();
    }

    private rightclick = (node: SkillNode) => {
        //this.skillTreeData.clearState(SkillNodeStates.Highlighted)
        if (this.skillTreeData.tree === "Atlas" && node.id === '41153'){
            this.seventhGateClick(true, node);
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
                let nodes = [...this.skillTreeData.groups[groupId].nodes]
                if (groupId === 25) nodes.push('54499', '55003')
                if (groupId === 127) nodes.push('9338','50203','5515')
                for(const nodeId of nodes){
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
        SkillTreeEvents.skill_tree.fire("highlighted-nodes-update");
    }

    public allocateNodes = () => {
        //console.time('Execution time')
        this.allocationAlgorithm.Execute(this.shortestPath);
        //console.timeEnd('Execution time')

        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        window.location.hash = '#' + this.encodeURL(false);
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

        SkillTreeEvents.skill_tree.fire("hovered-nodes-start", node);
    }

    private mouseout = (node: SkillNode) => {
        this.skillTreeData.clearState(SkillNodeStates.Hovered);
        this.skillTreeData.clearState(SkillNodeStates.Pathing);
        this.skillTreeDataCompare?.clearState(SkillNodeStates.Hovered);
        SkillTreeEvents.skill_tree.fire("hovered-nodes-end", node);
    }
}
