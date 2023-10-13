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
        for (const node of nodesToDisable){
            this.skillTreeData.removeState(node, SkillNodeStates.Active);
        }

        const desiredNodesUnsorted = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired))
        let desiredNodes = desiredNodesUnsorted
        
        
        const desiredGroupDistances = this.adjustDesiredGroupDistances(desiredNodes.filter(node => node.isNotable), 0.01)

        if(desiredNodes.length > 0){
            let count = 0
            while (desiredNodes.length > 0){
                if(++count > 100){
                    console.log('Infinite loop detection triggered. Please report this as a bug.')
                    break;
                }

                const paths: Array<{ id: string, path: Array<SkillNode> }> = [];
                for(const node of desiredNodes){
                    const id = node.GetId();
                    const path = shortestPathAlgorithm.Execute(this.skillTreeData, node, desiredGroupDistances, false);
                    if(path.length > 0)
                        paths.push({id, path})
                }
                if(paths.length == 0){
                    if(debug) console.log('No paths found')
                    break;
                }
                paths.sort((a,b) => a.path.length - b.path.length)
                const shortestPath = paths.shift()
                if (shortestPath === undefined){
                    if(debug) console.log('Shortest path undefined')
                    return;
                }
                    
                const shortestPathNode = this.skillTreeData.nodes[shortestPath.id]
                if (!shortestPathNode.is(SkillNodeStates.Active)) {
                    if(debug) console.log('Added', shortestPathNode.id, '(' + shortestPathNode.name + ')')
                    this.skillTreeData.addState(shortestPathNode, SkillNodeStates.Active);
                }
                
                for (const i of shortestPath.path) {
                    if (!i.is(SkillNodeStates.Active)) {
                        if(debug) console.log('Added', i.id, '(' + i.name + ')')
                        this.skillTreeData.addState(i, SkillNodeStates.Active);
                    }
                }

                desiredNodes = desiredNodes.filter(node => !node.is(SkillNodeStates.Active))
            }
        }
    }

    private adjustDesiredGroupDistances = (desiredNodes: Array<SkillNode>, adjustment: number): {[nodeId: string]: number} => {
        const nodeDistanceWeights: {[nodeId: string]: number} = {}
    
        function getDistance(x1: number, y1: number, x2: number, y2: number){
            const x = x2 - x1
            const y = y2 - y1
    
            return Math.sqrt(x * x + y * y)
        }
    
        for(const node of desiredNodes){
            const groupId = node.group
            if(groupId === undefined) continue 
            const group = this.skillTreeData.groups[groupId]
            const nodeIds = group.nodes
            let furthestDistance = 0
            let totalX = 0, totalY = 0;
            let masteryType = ''
            for (const nodeId of nodeIds){
                const node = this.skillTreeData.nodes[nodeId]
                if(node.isMastery) masteryType = node.name
                totalX += node.x;
                totalY += node.y;
            }
            
            const centerX = totalX / nodeIds.length;
            const centerY = totalY / nodeIds.length;
            
            for (const nodeId of nodeIds){
                const node = this.skillTreeData.nodes[nodeId]
                if(node.name === 'Map Drop Duplication' || node.name === 'Adjacent Map Drop Chance') continue
                
                const distance = getDistance(centerX, centerY, node.x , node.y)
                furthestDistance = distance > furthestDistance ? distance : furthestDistance;
            }
            const nodesInRange = this.skillTreeData.getNodesInRange(centerX, centerY, furthestDistance * 1.05);
            for(const node of nodesInRange){
                let wrongMastery = false
                if(masteryType != '' && node.group && node.group !== groupId){
                    for(const newGroupNodeId of this.skillTreeData.groups[node.group].nodes){
                        const newGroupNode = this.skillTreeData.nodes[newGroupNodeId]
                        if(newGroupNode.isMastery && newGroupNode.name !== masteryType) wrongMastery = true
                    }
                }
                if(wrongMastery) continue;
                nodeDistanceWeights[node.id] = 1 - adjustment
            }
        }
        return nodeDistanceWeights
    }
}