import { SkillNode } from "models/SkillNode";
import { SkillTreeData } from "models/SkillTreeData";
import { SkillTreeEvents } from "models/SkillTreeEvents";

export class UIEvents {
    private DRAG_THRESHOLD_SQUARED = 4 * 4;
    private dragTimeoutActive = false;
    private dragTimeout = 50;
    private start: IPoint = { x: 0, y: 0 };
    private dragged: boolean = false;
    private hovered: SkillNode | null = null;
    private hoverNeedsRefresh = false;

    skillTreeData: SkillTreeData;
    skillTreeDataCompare: SkillTreeData | undefined;

    constructor(context: SkillTreeData, contextComapre: SkillTreeData | undefined) {
        this.skillTreeData = context;
        this.skillTreeDataCompare = contextComapre;

        SkillTreeEvents.viewport.on("up", this.up);
        SkillTreeEvents.viewport.on("rightup", this.rightup);
        SkillTreeEvents.viewport.on("move", this.move);
        SkillTreeEvents.viewport.on("down", this.down);
        SkillTreeEvents.viewport.on("cancel", () => setTimeout(() => this.cancelDrag(), this.dragTimeout));
        SkillTreeEvents.viewport.on("zoom", this.invalidateHover);
        SkillTreeEvents.skill_tree.on("highlighted-nodes-update", this.invalidateHover);
        SkillTreeEvents.skill_tree.on("active-nodes-update", this.invalidateHover);
    }

    private invalidateHover = () => {
        this.hoverNeedsRefresh = true;
    }

    private up = (point: IPoint) => {
        if (!this.dragged) {
            UIEvents.clickSkillTree(point, this.skillTreeData);
        }
        if (!this.dragTimeoutActive) {
            setTimeout(() => this.cancelDrag(), this.dragTimeout)
            this.dragTimeoutActive = true;
        }
    }

    private rightup = (point: IPoint) => {
        if (!this.dragged) {
            UIEvents.rightClickSkillTree(point, this.skillTreeData);
        }
        if (!this.dragTimeoutActive) {
            setTimeout(() => this.cancelDrag(), this.dragTimeout)
            this.dragTimeoutActive = true;
        }
    }

    private static clickSkillTree = (point: IPoint, skillTree: SkillTreeData) => {
        const node = skillTree.getNodeAtPoint(point);
        if (node === null) {
            return;
        }
        SkillTreeEvents.node.fire("click", node);
    }

    private static rightClickSkillTree = (point: IPoint, skillTree: SkillTreeData) => {
        const node = skillTree.getNodeAtPoint(point);
        if (node === null) {
            return;
        }
        SkillTreeEvents.node.fire("rightclick", node);
    }

    private cancelDrag = () => {
        this.start = { x: 0, y: 0 };
        this.dragged = false;
        this.dragTimeoutActive = false;
    }

    private down = (point: IPoint) => {
        this.start = { x: point.x, y: point.y };
    }

    private move = (points: IPoint[]) => {
        const globalPoint = points[0];
        const screenPoint = points[1];
        if (!this.dragged && this.start.x !== 0 && this.start.y !== 0) {
            const diff = { x: this.start.x - screenPoint.x, y: this.start.y - screenPoint.y };
            this.dragged = this.dragged || (diff.x * diff.x + diff.y * diff.y) > this.DRAG_THRESHOLD_SQUARED;
        }

        const current = this.skillTreeData.getNodeAtPoint(globalPoint)
            ?? this.skillTreeDataCompare?.getNodeAtPoint(globalPoint)
            ?? null;
        if (current === this.hovered && !this.hoverNeedsRefresh) {
            return;
        }

        if (this.hovered !== null && this.hovered !== current) {
            SkillTreeEvents.node.fire("out", this.hovered);
        }

        this.hovered = current;
        this.hoverNeedsRefresh = false;
        if (current !== null) {
            SkillTreeEvents.node.fire("in", current);
        }
    }
}
