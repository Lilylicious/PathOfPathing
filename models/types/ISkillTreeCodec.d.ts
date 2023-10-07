import { ISkillTreeData } from "./ISkillTreeData";

interface ISkillTreeCodec {
    encodeURL(skillTreeData: ISkillTreeData, allocated: boolean): string;
    decodeURL(encoding: string, skillTreeData: ISkillTreeData, allocated: boolean): SkillTreeDefinition;
}

type SkillTreeDefinition = {
    Version: number;
    Fullscreen: number;
    Class: number;
    Ascendancy: number;
    Nodes: Array<ISkillNode>;
    Desired: Array<ISkillNode>;
    Undesired: Array<ISkillNode>;
}