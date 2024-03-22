import { SkillTreeData } from "models/SkillTreeData";
import { IAllocationAlgorithm } from "./IAllocationAlgorithm";
import { SkillNode, SkillNodeStates } from "models/SkillNode";
import { ShortestPathAlgorithm } from "./ShortestPathAlgorithm";


export class AllocateNodesAlgorithm implements IAllocationAlgorithm {
    skillTreeData: SkillTreeData;

    constructor(treeData: SkillTreeData) {
        this.skillTreeData = treeData;
    }

    Execute(shortestPathAlgorithm: ShortestPathAlgorithm): void {
        const debug = false
        const nodesToDisable = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).filter(node => node.classStartIndex === undefined && !node.isAscendancyStart)
        for (const node of nodesToDisable) {
            this.skillTreeData.removeState(node, SkillNodeStates.Active);
        }

        const startNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
            .filter(node => node.classStartIndex !== undefined)[0]?.out
            .filter(nodeId => this.skillTreeData.nodes[nodeId].isAscendancyStart === false)
            .map(nodeId => this.skillTreeData.nodes[nodeId])
            .filter(node => !node.is(SkillNodeStates.UnDesired));
        const desiredNodesUnsorted = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired))
        let desiredNodes = desiredNodesUnsorted.sort((b, a) => {
            let distanceA = 100
            let distanceB = 100

            for (const node of startNodes) {
                const distA = this.skillTreeData.nodes[a.GetId()].distance[node.GetId()]
                const distB = this.skillTreeData.nodes[b.GetId()].distance[node.GetId()]

                if (distA === undefined || distB === undefined)
                    return -1

                distanceA = distA < distanceA ? distA : distanceA;
                distanceB = distB < distanceB ? distB : distanceB;
            }
            if (distanceA < distanceB)
                return -1
            if (distanceA > distanceB)
                return 1

            return 0
        });


        const desiredGroupDistances = this.adjustDesiredGroupDistances(desiredNodes.filter(node => node.isNotable), 0.01)

        for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isNotable)) {
            desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - 0.5 : 0.5;

            for (const stat of node.stats) {
                if (stat.includes('maximum Life')) desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - 0.01 : 0.99;
            }
        }

        if (desiredNodes.length > 0) {
            let count = 0
            while (desiredNodes.length > 0) {
                if (++count > 100) {
                    console.log('Infinite loop detection triggered. Please report this as a bug.')
                    break;
                }

                const paths: Array<{ id: string, path: Array<SkillNode> }> = [];
                for (const node of desiredNodes) {
                    const id = node.GetId();
                    const path = shortestPathAlgorithm.Execute(this.skillTreeData, node, desiredGroupDistances, false);
                    if (path.length > 0)
                        paths.push({ id, path })
                }
                if (paths.length == 0) {
                    if (debug) console.log('No paths found')
                    break;
                }
                paths.sort((a, b) => a.path.length - b.path.length)
                const shortestPath = paths.shift()
                if (shortestPath === undefined) {
                    if (debug) console.log('Shortest path undefined')
                    return;
                }

                const shortestPathNode = this.skillTreeData.nodes[shortestPath.id]
                if (!shortestPathNode.is(SkillNodeStates.Active)) {
                    if (debug) console.log('Added', shortestPathNode.id, '(' + shortestPathNode.name + ')')
                    this.skillTreeData.addState(shortestPathNode, SkillNodeStates.Active);
                }

                for (const i of shortestPath.path) {
                    if (!i.is(SkillNodeStates.Active)) {
                        if (debug) console.log('Added', i.id, '(' + i.name + ')')
                        this.skillTreeData.addState(i, SkillNodeStates.Active);
                    }
                }

                desiredNodes = desiredNodes.filter(node => !node.is(SkillNodeStates.Active))

                if (desiredNodes.length === 0) {
                    //this.addRoot(startNodes, debug, desiredGroupDistances)
                }
            }
        }


        //Cull extra nodes
        const requiredNodes: { [id: string]: SkillNode } = {};


        //Find definitely required unbranching paths
        let frontier = [...desiredNodesUnsorted]
        const explored: { [id: string]: SkillNode } = {};
        while (frontier.length > 0) {
            const currentNode = frontier.shift();
            if (currentNode === undefined) break;
            explored[currentNode.GetId()] = currentNode
            requiredNodes[currentNode.GetId()] = currentNode

            const adjacent = [...new Set([...currentNode.out, ...currentNode.in])]
                .filter(id => !explored[id])
                .map(id => this.skillTreeData.nodes[id])
                .filter(node => node.is(SkillNodeStates.Active))

            //Abort path check when more than one path is found
            if (adjacent.length > 1) continue;

            for (const node of adjacent) {
                if (explored[node.GetId()]) continue;
                frontier.push(node);
            }
        }

        if (Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).length <= 1) return;

        const startNodeIds = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
            .filter(node => node.classStartIndex !== undefined)[0]?.out
            .filter(nodeId => this.skillTreeData.nodes[nodeId].is(SkillNodeStates.Active))
            .map(id => this.skillTreeData.nodes[id])

        for (const start of startNodeIds) {
            requiredNodes[start.GetId()] = start;
        }

        let notRequiredNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active))
            .filter(node => !requiredNodes[node.GetId()])

        for (const node of notRequiredNodes) {
            //console.log('Checking ' + node.GetId())
            let frontier = [...startNodeIds]
            const explored2: { [id: string]: SkillNode } = {};
            while (frontier.length > 0) {
                const currentNode = frontier.shift();
                if (currentNode === undefined) break;
                explored2[currentNode.GetId()] = currentNode

                const adjacent = [...new Set([...currentNode.out, ...currentNode.in])]
                    .filter(id => !explored2[id])
                    .map(id => this.skillTreeData.nodes[id])
                    .filter(node => node.is(SkillNodeStates.Active))
                    .filter(adjacentNode => adjacentNode.GetId() !== node.GetId())

                for (const node of adjacent) {
                    if (explored2[node.GetId()]) continue;
                    frontier.unshift(node);
                }
            }

            let allDesiredFound = true;
            for (const desired of desiredNodesUnsorted) {
                if (!explored2[desired.GetId()]) {
                    //console.log("Didn't find " + desired.GetId() + " because of " + node.GetId())
                    allDesiredFound = false;
                    break;
                }
            }

            if (!allDesiredFound) {
                //console.log('Adding to required ' + node.GetId()) 
                requiredNodes[node.GetId()] = node;
            } else {
                const yeeted = node;
                if (yeeted === undefined) break;
                this.skillTreeData.removeState(yeeted, SkillNodeStates.Active)
                //console.log('Yeeted ' + yeeted?.GetId())
            }
        }
    }

    private adjustDesiredGroupDistances = (desiredNodes: Array<SkillNode>, adjustment: number): { [nodeId: string]: number } => {
        const nodeDistanceWeights: { [nodeId: string]: number } = {}

        function getDistance(x1: number, y1: number, x2: number, y2: number) {
            const x = x2 - x1
            const y = y2 - y1

            return Math.sqrt(x * x + y * y)
        }

        for (const node of desiredNodes) {
            const groupId = node.group
            if (groupId === undefined) continue
            const group = this.skillTreeData.groups[groupId]
            const nodeIds = group.nodes
            let furthestDistance = 0
            let totalX = 0, totalY = 0;
            let masteryType = ''
            for (const nodeId of nodeIds) {
                const node = this.skillTreeData.nodes[nodeId]
                if (node.isMastery) masteryType = node.name
                totalX += node.x;
                totalY += node.y;
            }

            const centerX = totalX / nodeIds.length;
            const centerY = totalY / nodeIds.length;

            for (const nodeId of nodeIds) {
                const node = this.skillTreeData.nodes[nodeId]
                if (node.name === 'Map Drop Duplication' || node.name === 'Adjacent Map Drop Chance') continue

                const distance = getDistance(centerX, centerY, node.x, node.y)
                furthestDistance = distance > furthestDistance ? distance : furthestDistance;
            }
            const nodesInRange = this.skillTreeData.getNodesInRange(centerX, centerY, furthestDistance * 1.05);
            for (const node of nodesInRange) {
                let wrongMastery = false
                if (masteryType != '' && node.group && node.group !== groupId) {
                    for (const newGroupNodeId of this.skillTreeData.groups[node.group].nodes) {
                        const newGroupNode = this.skillTreeData.nodes[newGroupNodeId]
                        if (newGroupNode.isMastery && newGroupNode.name !== masteryType) wrongMastery = true
                    }
                }
                if (wrongMastery) continue;
                nodeDistanceWeights[node.id] = 1 - adjustment
            }
        }
        return nodeDistanceWeights
    }
}