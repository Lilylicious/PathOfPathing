﻿import { ISkillTreeCodec, SkillTreeDefinition } from "../types/ISkillTreeCodec";
import { ISkillTreeData } from "../types/ISkillTreeData";
import { ISkillTreeUrlData } from "./ISkillTreeUrlData";
import { ISkillTreeUrlDecoder } from "./decoders/ISkillTreeUrlDecoder";
import { SkillTreeUrlV3Decoder } from "./decoders/SkillTreeUrlV3Decoder";
import { SkillTreeUrlV4Decoder } from "./decoders/SkillTreeUrlV4Decoder";
import { SkillTreeUrlV5Decoder } from "./decoders/SkillTreeUrlV5Decoder";
import { SkillTreeUrlV6Decoder } from "./decoders/SkillTreeUrlV6Decoder";

export class SkillTreeCodec implements ISkillTreeCodec {
    private static _decoders: ISkillTreeUrlDecoder[] = [
        new SkillTreeUrlV6Decoder(),
        new SkillTreeUrlV5Decoder(),
        new SkillTreeUrlV4Decoder(),
        new SkillTreeUrlV3Decoder()
    ];

    encodeURL(skillTreeData: ISkillTreeData, allocated: boolean): string {
        const bytes = [];
        const version = 6;
        bytes.push(version >> 24 & 0xFF);
        bytes.push(version >> 16 & 0xFF);
        bytes.push(version >> 8 & 0xFF);
        bytes.push(version >> 0 & 0xFF);
        bytes.push(skillTreeData.getStartClass());
        const ascendancy = skillTreeData.getAscendancyClass();
        const wildwoodAscendancy = skillTreeData.getWildwoodAscendancyClass();
        bytes.push(wildwoodAscendancy << 2 | (ascendancy & 0x3));

        const skilledNodes = skillTreeData.getSkilledNodes();
        const nodes = new Array<ISkillNode>();
        const extendedNodes = new Array<ISkillNode>();
        const desiredNodes = skillTreeData.getDesiredNodes();
        const undesiredNodes = skillTreeData.getUndesiredNodes();
        
        if(!allocated){
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
                const node = skilledNodes[id];
                if (node.classStartIndex !== undefined || node.isAscendancyStart) {
                    continue;
                }
                if (node.expansionJewel !== undefined) {
                    extendedNodes.push(node);
                } else if (!node.isMastery) {
                    nodes.push(node);
                }
            }
            nodes.sort((a, b) => { return +(a.id || a.skill) - +(b.id || a.skill) });
        }
        

        bytes.push(nodes.length);
        if(!allocated){
            bytes.push(Object.keys(desiredNodes).length)
            bytes.push(Object.keys(undesiredNodes).length)
        }
        for (const node of nodes) {
            bytes.push(+(node.id || node.skill) >> 8 & 0xFF);
            bytes.push(+(node.id || node.skill) & 0xFF);
        }

        bytes.push(extendedNodes.length);
        for (const node of extendedNodes) {
            bytes.push(+(node.id || node.skill) >> 8 & 0xFF);
            bytes.push(+(node.id || node.skill) & 0xFF);
        }

        const masteryEffects = new Array<[id: number, effect: number]>()
        for (const id in skillTreeData.masteryEffects) {
            const effect = skillTreeData.masteryEffects[id];
            masteryEffects.push([+id, effect])
        }

        bytes.push(masteryEffects.length)
        for (const [id, effect] of masteryEffects) {
            bytes.push((effect >> 8) & 0xFF);
            bytes.push(effect & 0xFF);
            bytes.push((id >> 8) & 0xFF);
            bytes.push(id & 0xFF);
        }

        return this.Uint8ArryToBase64(new Uint8Array(bytes));
    }

    decodeURL(encoding: string, skillTreeData: ISkillTreeData, allocated: boolean): SkillTreeDefinition {
        const bytes = this.Base64ToUint8Array(encoding);
        const data = this.decode(bytes, allocated);
        const skillTreeDefinition: SkillTreeDefinition = {
            Version: data.version,
            Class: data.class,
            Ascendancy: data.ascendancy,
            WildwoodAscendancy: data.wildwoodAscendancy,
            Nodes: [],
            ExtendedNodes: [],
            MasteryEffects: [],
            Desired: new Array<ISkillNode>(),
            Undesired: new Array<ISkillNode>()
        };


        for (const id of data.nodes) {
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                skillTreeDefinition.Nodes.push(node);
            }
        }

        for (const id of data.desiredNodes) {
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                skillTreeDefinition.Desired.push(node);
            }
        }

        for (const id of data.undesiredNodes) {
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                skillTreeDefinition.Undesired.push(node);
            }
        }

        for (const id of data.extendedNodes) {
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                skillTreeDefinition.ExtendedNodes.push(node);
            }
        }

        for (const [id, effect] of data.masteryEffects) {
            const node = skillTreeData.nodes[id.toString()];
            if (node !== undefined) {
                skillTreeDefinition.MasteryEffects.push([node, effect]);
            }
        }
        return skillTreeDefinition;
    }

    decode(bytes: Uint8Array, allocated: boolean): ISkillTreeUrlData {
        for (const decoder of SkillTreeCodec._decoders) {
            if (decoder.canDecode(bytes)) {
                return decoder.decode(bytes, allocated);
            }
        }

        return {
            version: 6,
            class: 3,
            ascendancy: 0,
            wildwoodAscendancy: 0,
            nodeCount: 0,
            nodes: [],
            extendedNodeCount: 0,
            extendedNodes: [],
            masteryEffectCount: 0,
            masteryEffects: [],
            desiredNodes: [],
            undesiredNodes: []
        }
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