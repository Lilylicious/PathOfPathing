import { SkillTreeData } from "models/SkillTreeData";
import { SkillNode, SkillNodeStates } from "../SkillNode";
import { IPathAlgorithm } from "./IPathAlgorithm";

import { FibonacciHeap } from 'mnemonist';

export class ShortestPathAlgorithm implements IPathAlgorithm {
    Execute(treeData: SkillTreeData, nodeGroup: SkillNode[], nodeDistanceWeights: { [nodeId: string]: number }, wantDebug: boolean): SkillNode[] {
        wantDebug = false//target.skill === 17015
        if(nodeGroup.length === 0) return new Array<SkillNode>();
        const target = nodeGroup[0];
        if (target.is(SkillNodeStates.Active)) {
            if (wantDebug) console.log('Early return 1')
            return new Array<SkillNode>;
        }
        if (target.isBlighted) {
            if (wantDebug) console.log('Early return 2')
            return new Array<SkillNode>(target);
        }
        let foundNode: SkillNode = target;
        const frontier: FibonacciHeap<SkillNode> = new FibonacciHeap((a, b) => {
            const aDist = distance[a.id]
            const bDist = distance[b.id]
            if (aDist === undefined || bDist === undefined) return 0;

            if (aDist < bDist) return -1;
            if (aDist > bDist) return 1;
            return 0;
        })

        frontier.push(target)
        const distance: { [id: string]: number } = {};
        distance[target.id] = 0
        const explored: { [id: string]: SkillNode } = {};
        explored[target.GetId()] = target;
        const prev: { [id: string]: SkillNode } = {};
        while (frontier.size > 0) {
            const current2 = frontier.pop();
            if (current2 === undefined) {
                if (wantDebug) console.log('Early return 3')
                break;
            }
            if (wantDebug) console.log('Current frontier ID', current2.GetId())

            explored[current2.GetId()] = current2;
            const dist = distance[current2.GetId()];
            let count = 0
            let adjacent = [...new Set([...current2.out, ...current2.in])]
            for (const id of adjacent) {
                if (++count > 20) break;
                if (wantDebug) console.log('Current out ID', id)
                const out = treeData.nodes[id];
                if ((current2.ascendancyName === "" && out.ascendancyName !== "" && !out.is(SkillNodeStates.Active))
                    || (current2.ascendancyName !== "" && out.ascendancyName === "" && !current2.is(SkillNodeStates.Active))) {
                    continue;
                }

                // const expandedRange = treeData.tree === 'Atlas' ? 500 : 500;
                // if(out.x < treeData.desired_min_x - expandedRange
                //     || out.x > treeData.desired_max_x + expandedRange
                //     || out.y < treeData.desired_min_y - expandedRange
                //     || out.y > treeData.desired_max_y + expandedRange
                //     ){
                //         continue;
                //     }

                let newDist = dist + (out.classStartIndex || out.is(SkillNodeStates.Desired) ? 0 : nodeDistanceWeights[id] !== undefined ? nodeDistanceWeights[id] : 1);

                if (explored[id] || (distance[id] && distance[id] < newDist)) {
                    continue;
                }
                if ((out.classStartIndex !== undefined || out.isAscendancyStart) && !out.is(SkillNodeStates.Active)) {
                    continue;
                }

                if (out.is(SkillNodeStates.UnDesired) || out.isMastery) {
                    continue;
                }

                if (wantDebug && !out.isMastery) console.log('Adding out node to frontier')
                distance[id] = newDist;
                if (wantDebug) console.log('Distance to out node', distance[id])

                //// Enable the below line to see all the visited nodes
                //treeData.addState(out, SkillNodeStates.Highlighted);

                prev[id] = current2;
                if (!out.isMastery) frontier.push(out);
                if (wantDebug) console.log('Is out active?', out.is(SkillNodeStates.Active))
                if (out.is(SkillNodeStates.Active)) {
                    frontier.clear()
                    foundNode = out;
                    break;
                }
            }
        }

        if (wantDebug) console.log('Found node', foundNode, foundNode === target, distance[foundNode.GetId()])
        if (foundNode === target || distance[foundNode.GetId()] === undefined) {
            return new Array<SkillNode>();
        }
        let current: SkillNode | undefined = foundNode;
        const path = new Array<SkillNode>();
        while (current !== undefined) {
            path.push(current);
            current = prev[current.GetId()];
        }
        return path.reverse();
    }

    private getDistance(x1: number, y1: number, x2: number, y2: number) {
        const x = x2 - x1
        const y = y2 - y1

        return Math.sqrt(x * x + y * y)
    }

}