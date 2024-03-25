import { SkillNode } from "../SkillNode";

interface IPathAlgorithm {
    Execute(treeData: SkillTreeData, target: SkillNode[], nodeDistanceWeights: { [nodeId: string]: number }, wantDebug: boolean): SkillNode[][];
}