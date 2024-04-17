import { SkillTreeData } from "models/SkillTreeData";
import { IPathAlgorithm } from "./IPathAlgorithm";


// This interface is expected to allocate nodes.
interface IAllocationAlgorithm {
    Execute(shortestPathAlgorithm: ShortestPathAlgorithm, maxSteps: number): void;
}