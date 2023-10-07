import { ISkillTreeCodec, SkillTreeDefinition } from "./types/ISkillTreeCodec";
import { ISkillTreeData } from "./types/ISkillTreeData";

export class SkillTreeCodec implements ISkillTreeCodec {
    encodeURL(skillTreeData: ISkillTreeData, allocated: boolean): string {
        const classid = skillTreeData.getStartClass();
        const ascid = skillTreeData.getAscendancyClass();
        const skilledNodes = skillTreeData.getSkilledNodes();
        const desiredNodes = skillTreeData.getDesiredNodes();
        const undesiredNodes = skillTreeData.getUndesiredNodes();
        const bytes = [];
        bytes.push(skillTreeData.version >> 24 & 0xFF);
        bytes.push(skillTreeData.version >> 16 & 0xFF);
        bytes.push(skillTreeData.version >> 8 & 0xFF);
        bytes.push(skillTreeData.version >> 0 & 0xFF);
        bytes.push(classid);
        bytes.push(ascid);
        bytes.push(skillTreeData.fullscreen);

        const nodes = new Array<ISkillNode>();
        if(!allocated){
            const desiredCount = Object.keys(desiredNodes).length;
            const unDesiredCount = Object.keys(undesiredNodes).length;
            bytes.push(desiredCount)
            bytes.push(unDesiredCount)
            
            for (const id in desiredNodes) {
                nodes.push(desiredNodes[id]);
            }
            for (const id in undesiredNodes) {
                nodes.push(undesiredNodes[id]);
            }
            const rootNode = Object.values(skillTreeData.getClassStartNodes()).filter(node => Object.keys(skilledNodes).includes(node.id || String(node.skill)))[0];
            nodes.push(rootNode)
        } else {
            for (const id in skilledNodes) {
                nodes.push(skilledNodes[id]);
            }
            nodes.sort((a, b) => { return +(a.id || a.skill) - +(b.id || a.skill) });
        }

        for (const node of nodes) {
            if (node.classStartIndex !== undefined || node.isAscendancyStart) {
                continue;
            }
            bytes.push(+(node.id || node.skill) >> 8 & 0xFF);
            bytes.push(+(node.id || node.skill) & 0xFF);
        }

        return this.Uint8ArryToBase64(new Uint8Array(bytes));
    }

    decodeURL(encoding: string, skillTreeData: ISkillTreeData, allocated: boolean): SkillTreeDefinition {
        const skillTreeDefinition: SkillTreeDefinition = { Version: 4, Class: 0, Ascendancy: 0, Fullscreen: 0, Nodes: new Array<ISkillNode>(), Desired: new Array<ISkillNode>(), Undesired: new Array<ISkillNode>() };
        const bytes = this.Base64ToUint8Array(encoding);
        skillTreeDefinition.Version = bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];
        skillTreeDefinition.Class = bytes[4];
        skillTreeDefinition.Ascendancy = bytes[5];

        if (skillTreeDefinition.Version > 3) {
            skillTreeDefinition.Fullscreen = bytes[6];
        }
        let allocIncrease = 0
        let desiredCount = 0;
        let unDesiredCount = 0;
        if(!allocated){
            desiredCount = bytes[7];
            unDesiredCount = bytes[8];
            allocIncrease = 2
        }
        let nodesRead = 0
        for (let i = (skillTreeDefinition.Version > 3 ? 7 + allocIncrease : 6 + allocIncrease); i < bytes.length; i += 2) {
            if(!allocated) nodesRead++
            const id = bytes[i] << 8 | bytes[i + 1];
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                if(allocated) {
                    skillTreeDefinition.Nodes.push(node);
                } else {
                    if(nodesRead <= desiredCount) {
                        skillTreeDefinition.Desired.push(node)
                    } else if (nodesRead <= desiredCount + unDesiredCount) {
                        skillTreeDefinition.Undesired.push(node)
                    } else {
                        skillTreeDefinition.Nodes.push(node)
                    }
                }
            }
        }
        return skillTreeDefinition;
    }

    Uint8ArryToBase64 = (arr: Uint8Array): string => {
        return btoa(Array.prototype.map.call(arr, (c: number) => String.fromCharCode(c)).join('')).replace(/\+/gi, "-").replace(/\//gi, "_");
    }

    Base64ToUint8Array = (str: string): Uint8Array => {
        str = atob(str.replace(/-/gi, "+").replace(/_/gi, "/"));
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            arr[i] = str.charCodeAt(i);
        }
        return arr;
    }
}