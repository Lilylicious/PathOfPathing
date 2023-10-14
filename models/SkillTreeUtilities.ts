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
        SkillTreeEvents.controls.on("search-change", this.searchChange);

        SkillTreeEvents.controls.on("import-change", this.importChange);
        SkillTreeEvents.skill_tree.on("encode-url", this.encodeURL);
    }

    //   https://www.pathofexile.com/fullscreen-passive-skill-tree/AAAABgMCNgHcBAcI9BEtFSAZihm0HwIi9CQtLJwtgzHvMlg6WEI6RnFVxl-wakNsC20ZbmlvnnfjfXWDCYPbhNmIj46-ksGTJ5cGm7WpbqyYtAy747zqvoq-p8M6xKLEuMpKytPTftX437Dvevaj_TD-ugAA
    //   https://www.pathofexile.com/fullscreen-passive-skill-tree/3.22.1/AAAABgIBfVb6fXX8xRR1EmOgOEp9Od295hcm45-NfdFvAtA_bK-8wL-kwsHV_rqklXsU5ikFLWLsvTZsjPsJgCIEtQSxbWySgOBpJpWjig-rUUeTHxxftorksRjbxKK-2xmK3viE712PBIcdQAqbTZIfQe4OoLE8vnXLG62MNnTtI_ZkpnSuj5nDOr6nH0y74ymlR37GAhqPMk4ILnTxJIudqod26dqE2WegeoQDhz9VDHPBgpuNsbMvzPbaRXwSMDY9Fr9_K11OMHxh4kCg6mIL4muQ2NVlTRLx21XmWNN-VUuv63fXX3A-z5cGk6O1SINtj_H9ASFgXhOkeFuOeu8ACJ1zEmNyHqA4b97Rb_WxBLX9a77b0XsdQLoaC-KJ5pOj
    private decodeImport = (str: string | undefined = undefined) => {
        if(str === undefined) return;
        const withoutDomain = str.replace('https://www.pathofexile.com/', '')
        const withoutTreeType = withoutDomain.replace('fullscreen-', '').replace('passive-skill-tree/', '')
        ///3.22.0/AAAABgIBfVb6fXX8xRR1EmOgOEp9Od295hcm45-NfdFvAtA_bK-8wL-kwsHV_rqklXsU5ikFLWLsvTZsjPsJgCIEtQSxbWySgOBpJpWjig-rUUeTHxxftorksRjbxKK-2xmK3viE712PBIcdQAqbTZIfQe4OoLE8vnXLG62MNnTtI_ZkpnSuj5nDOr6nH0y74ymlR37GAhqPMk4ILnTxJIudqod26dqE2WegeoQDhz9VDHPBgpuNsbMvzPbaRXwSMDY9Fr9_K11OMHxh4kCg6mIL4muQ2NVlTRLx21XmWNN-VUuv63fXX3A-z5cGk6O1SINtj_H9ASFgXhOkeFuOeu8ACJ1zEmNyHqA4b97Rb_WxBLX9a77b0XsdQLoaC-KJ5pOj
        const regex = /\d\.\d\d\.\d\//g
        const data = withoutTreeType.replace(regex, '')
        
        try {
            if (data === null) {
                console.log('Data is null')
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
            for (const node of def.Nodes) {
                if(node.isNotable || node.isKeystone || node.isJewelSocket || node.isAscendancyStart || node.classStartIndex !== undefined)
                    this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }
            
            for (const node of def.ExtendedNodes) {
                if(node.isNotable || node.isKeystone || node.isJewelSocket || node.isAscendancyStart || node.classStartIndex !== undefined)
                    this.skillTreeData.addStateById(`${node.skill}`, SkillNodeStates.Desired)
            }

            for (const [node, effect] of def.MasteryEffects) {
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

        SkillTreeEvents.skill_tree.fire("normal-node-count", normalNodes);
        SkillTreeEvents.skill_tree.fire("normal-node-count-maximum", maximumNormalPoints);
        SkillTreeEvents.skill_tree.fire("ascendancy-node-count", ascNodes);
        SkillTreeEvents.skill_tree.fire("ascendancy-node-count-maximum", maximumAscendancyPoints);
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
