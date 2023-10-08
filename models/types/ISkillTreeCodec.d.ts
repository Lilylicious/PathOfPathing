import { ISkillTreeData } from "./ISkillTreeData";

interface ISkillTreeCodec {
    encodeURL(skillTreeData: ISkillTreeData, allocated: boolean): string;
    decodeURL(encoding: string, skillTreeData: ISkillTreeData, allocated: boolean): SkillTreeDefinition;
}

type SkillTreeDefinition = {
    Version: number;
    Class: number;
    Ascendancy: number;
    Nodes: Array<ISkillNode>;
    ExtendedNodes: Array<ISkillNode>;
    MasteryEffects: Array<[node: ISkillNode, effect: number]>;
    Desired: Array<ISkillNode>;
    Undesired: Array<ISkillNode>;
}
