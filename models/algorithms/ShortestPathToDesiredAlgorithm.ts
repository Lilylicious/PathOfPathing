import { SkillTreeData } from "../SkillTreeData";
import { SkillNode, SkillNodeStates } from "../SkillNode";
import { IPathAlgorithm } from "./IPathAlgorithm";

import { FibonacciHeap } from 'mnemonist';

export class ShortestPathToDesiredAlgorithm implements IPathAlgorithm  {
    Execute(treeData: SkillTreeData, nodeGroup: SkillNode[], nodeDistanceWeights: { [nodeId: string]: number }, wantDebug: boolean): SkillNode[][] {
        wantDebug = false//target.skill === 17015
        if(nodeGroup.length === 0) return new Array<Array<SkillNode>>();

        const nodesChecked: string[] = [];
        let shortestPath = 999;

        const frontier: FibonacciHeap<SkillNode> = new FibonacciHeap((a, b) => {
            const aDist = distance[a.id]
            const bDist = distance[b.id]
            if (aDist === undefined || bDist === undefined) return 0;

            if (aDist < bDist) return -1;
            if (aDist > bDist) return 1;
            return 0;
        })

        const pathsFound: FibonacciHeap<SkillNode[]> = new FibonacciHeap((a, b) => {
            if (a.length === undefined || b.length === undefined) return 0;

            if (a.length < b.length) return -1;
            if (a.length > b.length) return 1;
            return 0;
        })


        const distance: { [id: string]: number } = {};
        const explored: { [id: string]: SkillNode } = {};
        const prev: { [id: string]: SkillNode } = {};

        for(const node of nodeGroup){
            frontier.push(node)
            distance[node.id] = 0
        }

        while (frontier.size > 0) {
            const frontierNode = frontier.pop();
            if (frontierNode === undefined) {
                if (wantDebug) console.log('frontierNode undefined')
                break;
            }

            if(nodesChecked.includes(frontierNode.GetId())) continue;

            if (wantDebug) console.log('Current frontier ID', frontierNode.GetId())

            explored[frontierNode.GetId()] = frontierNode;
            const dist = distance[frontierNode.GetId()];
            let count = 0
            let adjacent = [...new Set([...frontierNode.out, ...frontierNode.in])]
            for (const id of adjacent) {
                if (++count > 20) break;
                if (wantDebug) console.log('Current out ID', id)
                const out = treeData.nodes[id];

                //Only go through active ascendancy roots
                if ((frontierNode.ascendancyName === "" && out.ascendancyName !== "" && !out.is(SkillNodeStates.Active))
                    || (frontierNode.ascendancyName !== "" && out.ascendancyName === "" && !frontierNode.is(SkillNodeStates.Active))) {
                    continue;
                }

                let newDist = dist + (out.classStartIndex || out.is(SkillNodeStates.Desired || nodeGroup.includes(out)) ? 0 : nodeDistanceWeights[id] !== undefined ? nodeDistanceWeights[id] : 1);

                if (wantDebug) console.log('Shortest path ' + shortestPath + ' and newDist ' + newDist)
                //if we've explored it, or the shortest path is shorter, or the distance it already has is shorter
                if (explored[id] || shortestPath < newDist || (distance[id] && distance[id] < newDist)) {
                    continue;
                }
                //if the new node is a class or ascendancy start, and not active
                if ((out.classStartIndex !== undefined || out.isAscendancyStart) && !out.is(SkillNodeStates.Active)) {
                    continue;
                }

                if (out.is(SkillNodeStates.UnDesired)) {
                    continue;
                }

                if (wantDebug && !out.isMastery) console.log('Adding out node to frontier')
                distance[id] = newDist;
                if (wantDebug) console.log('Distance to out node', distance[id])

                //// Enable the below line to see all the visited nodes
                //treeData.addState(out, SkillNodeStates.Highlighted);

                prev[id] = frontierNode;
                if (!out.isMastery) frontier.push(out);
                if (wantDebug) console.log('Is out active?', out.is(SkillNodeStates.Active))
                if (!nodeGroup.includes(out) && out.is(SkillNodeStates.Active)) {
                    const foundNode = out;
                    if (wantDebug) console.log('FOUND NODE')

                    if (foundNode === frontierNode || distance[foundNode.GetId()] === undefined) {
                        //No path found, do what?
                    }

                    let current: SkillNode | undefined = foundNode;
                    const idsInGroup = nodeGroup.map(node => node.GetId());
                    const path = new Array<SkillNode>();
                    let foundFirst = false;
                    while (current !== undefined) {
                        //If the new node is not already part of the current group, add to path
                        if(!idsInGroup.includes(current.GetId())) {
                            if (wantDebug) console.log('Added ' + current.GetId() + ' to path')
                            path.push(current);
                        } else {
                            if(!foundFirst){
                                if (wantDebug) console.log('Added ' + current.GetId() + ' to path')
                                path.push(current)  
                                foundFirst = true;
                            } 
                        }
                        if(!nodesChecked.includes(current.GetId())) nodesChecked.push(current.GetId());

                        // if(nodesChecked.length === nodeGroup.length) {
                        //     frontier.clear()
                        //     if (wantDebug) console.log('Cleared frontier')                            
                        // }
                        current = prev[current.GetId()];
                    }
                    
                    if(path.length > shortestPath * 2){
                        const paths: SkillNode[][] = []
                        let returnPath = pathsFound.pop();
                        while(returnPath !== undefined) {
                            if (wantDebug) console.log(returnPath.length, shortestPath)
                            if(returnPath.length - 2 == shortestPath) {
                                paths.push(returnPath)
                            } else {
                                break;
                            }
                            returnPath = pathsFound.pop();
                        }
                
                        if (wantDebug) console.log('Returning ' + paths.length + ' paths')
                
                        return paths;
                    }


                    shortestPath = path.length - 2;
                    pathsFound.push(path.reverse());
                }
            }
        }
        const paths: SkillNode[][] = []
        let returnPath = pathsFound.pop();
        while(returnPath !== undefined) {
            if (wantDebug) console.log(returnPath.length, shortestPath)
            if(returnPath.length - 2 == shortestPath) {
                paths.push(returnPath)
            } else {
                break;
            }
            returnPath = pathsFound.pop();
        }

        if (wantDebug) console.log('Returning ' + paths.length + ' paths')

        return paths;
    }    
}