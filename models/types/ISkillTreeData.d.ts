import { SemVer } from "semver";

interface ISkillTreeData extends ISkillTreeV15 {
    patch: SemVer;
    version: number;
    masteryEffects: { [id: number]: number }

    getStartClass(): number;
    getAscendancyClass(): number;
    getWildwoodAscendancyClass(): number;
    getSkilledNodes(): { [id: string]: ISkillNode };
    getHoveredNodes(): { [id: string]: ISkillNode };
    getDesiredNodes(): { [id: string]: ISkillNode };
    getUndesiredNodes(): { [id: string]: ISkillNode };
    getClassStartNodes(): { [id: string]: ISkillNode };
}