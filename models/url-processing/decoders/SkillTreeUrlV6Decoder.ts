import { ISkillTreeUrlDecoder } from "./ISkillTreeUrlDecoder";
import { ISkillTreeUrlData } from "../ISkillTreeUrlData";

export class SkillTreeUrlV6Decoder implements ISkillTreeUrlDecoder {
    canDecode(bytes: Uint8Array): boolean {
        return bytes.length >= 9 && this.version(bytes) == 6;
    }

    decode(bytes: Uint8Array, allocated: boolean): ISkillTreeUrlData {
        const version = this.version(bytes);
        const _class = this.class(bytes);
        const ascendancyByte = this.ascendancyByte(bytes);
        const ascendancy = ascendancyByte & 0x3;
        const wildwoodAscendancy = ascendancyByte >> 2;
        let offset = 6;

        const nodeCount = bytes[offset++];
        const desiredNodeCount = allocated ? 0 : bytes[offset++];
        const unDesiredNodeCount = allocated ? 0 : bytes[offset++];

        const nodes = new Array<number>()
        const extendedNodes = new Array<number>()
        const desiredNodes = new Array<number>()
        const unDesiredNodes = new Array<number>()
        if(allocated) {
            for (let i = 0; i < nodeCount; i++) {
                if (offset + 1 > bytes.length) {
                    break;
                }
                nodes.push(bytes[offset++] << 8 | bytes[offset++])
            }

            const extendedNodeCount = bytes[offset++];
            for (let i = 0; i < extendedNodeCount; i++) {
                if (offset + 1 > bytes.length) {
                    break;
                }
                extendedNodes.push(bytes[offset++] << 8 | bytes[offset++])
            }
        } else {
            for (let i = 0; i < desiredNodeCount; i++) {
                if (offset + 1 > bytes.length) {
                    break;
                }
                desiredNodes.push(bytes[offset++] << 8 | bytes[offset++])
            }

            for (let i = 0; i < unDesiredNodeCount; i++) {
                if (offset + 1 > bytes.length) {
                    break;
                }
                unDesiredNodes.push(bytes[offset++] << 8 | bytes[offset++])
            }
            nodes.push(bytes[offset++] << 8 | bytes[offset++])
        }

        const masteryEffectCount = bytes[offset++];
        const masteryEffects = new Array<[id: number, effect: number]>()
        for (let i = 0; i < masteryEffectCount; i++) {
            if (offset + 3 > bytes.length) {
                break;
            }
            var effect = bytes[offset++] << 8 | bytes[offset++];
            var id = bytes[offset++] << 8 | bytes[offset++];
            masteryEffects.push([id, effect]);
        }
        return {
            version: version,
            class: _class,
            ascendancy: ascendancy,
            wildwoodAscendancy: wildwoodAscendancy,
            nodeCount: nodes.length,
            nodes: nodes,
            extendedNodeCount: extendedNodes.length,
            extendedNodes: extendedNodes,
            masteryEffectCount: masteryEffects.length,
            masteryEffects: masteryEffects,
            desiredNodes: desiredNodes,
            undesiredNodes: unDesiredNodes
        }
    }

    private version(bytes: Uint8Array): number {
        return bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]
    }

    private class(bytes: Uint8Array): number {
        return bytes[4]
    }

    private ascendancyByte(bytes: Uint8Array): number {
        return bytes[5]
    }
}