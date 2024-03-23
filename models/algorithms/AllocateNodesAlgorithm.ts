import { SkillTreeData } from "models/SkillTreeData";
import { IAllocationAlgorithm } from "./IAllocationAlgorithm";
import { SkillNode, SkillNodeStates } from "models/SkillNode";
import { ShortestPathAlgorithm } from "./ShortestPathAlgorithm";
import { versions } from "../versions/verions";


export class AllocateNodesAlgorithm implements IAllocationAlgorithm {
    skillTreeData: SkillTreeData;
    fixedGroups: { abyssGroup: number; exarchGroup: number; }


    constructor(treeData: SkillTreeData, fixedGroups: { abyssGroup: number; exarchGroup: number; }) {
        this.skillTreeData = treeData;
        this.fixedGroups = fixedGroups;
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


        const desiredAdjustment = 0.01;
        const desiredGroupDistances = this.adjustDesiredGroupDistances(desiredNodes.filter(node => node.isNotable), desiredAdjustment)

        for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isNotable)) {
            desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - 0.5 : 0.5;

            for (const stat of node.stats) {
                if (stat.includes('maximum Life')) desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - (2 * desiredAdjustment) : 1 - (2 * desiredAdjustment);
            }
        }

        const travelStats = ['1% increased quantity of items found in your maps', '3% increased scarabs found in your maps', '2% increased effect of modifiers on your maps', '2% chance for one monster in each of your maps to drop an additional connected map']
        const singleEntranceNodes: { [node: string]: number } = {}
        for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isMastery)) {
            const debugSingleEntrance = false//node.skill === 1240
            const groupNodes = node.nodeGroup?.nodes
            if (groupNodes === undefined) continue;
            const nodes = [...groupNodes]
            if(this.skillTreeData.tree.slice(0,5) === 'Atlas'){
                if (nodes.includes('65499')) nodes.push('54499', '55003')
                if (nodes.includes('19599')) nodes.push('9338', '50203', '5515')
                if (nodes.includes('60105')) nodes.push('62161', '4703', '27878')
                if (nodes.includes('26320')) nodes.push('44872', '59578', '41869')
                if (nodes.includes('1240')) nodes.push('50610', '3198', '54101')
            }

            const potentialOutsideNodes: SkillNode[] = []

            for (const id of nodes) {
                if (debugSingleEntrance) console.log('Checking group node ' + id)
                const searchNode = this.skillTreeData.nodes[id];
                if(searchNode === undefined) continue;
                const adjacent = [...searchNode.in, ...searchNode.out]
                for (const adjacentId of adjacent) {
                    if (debugSingleEntrance) console.log('Checking adjacent node ' + adjacentId)
                    const adjacentNode = this.skillTreeData.nodes[adjacentId];
                    //if(!nodes.includes(adjacentId) || adjacentNode.stats.map(stat => stat.toLocaleLowerCase()).some(stat => travelStats.includes(stat))){
                    for (const stat of adjacentNode.stats) {
                        if (debugSingleEntrance) console.log('Checking stat ' + stat.toLocaleLowerCase())
                        if (travelStats.includes(stat.toLowerCase()) && !potentialOutsideNodes.includes(adjacentNode)) {
                            if (debugSingleEntrance) console.log('Adding outside node ' + adjacentId)
                            potentialOutsideNodes.push(adjacentNode);
                        }
                    }
                    //}
                }

            }

            if (debugSingleEntrance) console.log('potential outside nodes length' + potentialOutsideNodes.length)
            if (potentialOutsideNodes.length === 1) {
                for (const id of nodes) {
                    singleEntranceNodes[id] = potentialOutsideNodes[0].skill;
                }
            }
        }

        for (const desiredNode of desiredNodes) {
            if (singleEntranceNodes[desiredNode.id]) {
                desiredGroupDistances[singleEntranceNodes[desiredNode.id]] = 0;
            }
        }



        const travelNodes = Object.values(this.skillTreeData.nodes).filter(node => this.skillTreeData.tree === 'Default' ? node.isRegular1 : (node.isRegular2 && node.stats.some(stat => travelStats.includes(stat.toLowerCase()))));

        for (const travelNode of travelNodes) {
            desiredGroupDistances[travelNode.id] = desiredGroupDistances[travelNode.id] !== undefined ? desiredGroupDistances[travelNode.id] * desiredAdjustment : 1 - desiredAdjustment;
        }



        const contentTypes = ['Alva', 'Anarchy', 'Bestiary', 'Beyond', 'Blight', 'Breach', 'CleansingFire', 'Conqueror',
            'Delirium', 'Delve', 'Domination', 'ElderShaper', 'Essence', 'Expedition', 'Harbinger', 'Harvest', 'Heist',
            'Jun', 'Kirac', 'Labyrinth', 'Legion', 'Map', 'Metamorph', 'Necropolis', 'Ritual', 'Scarab', 'Sextant', 'Strongbox', 'Synthesis',
            'Tangle', 'Torment', 'Vaal']

        for (const contentType of contentTypes) {
            if (desiredNodes.filter(node => node.GetIcon().toLowerCase().indexOf(contentType.toLowerCase()) > -1 && node.GetIcon().toLowerCase().indexOf('wheelofdisabling') === -1).filter(node => !travelNodes.includes(node)).length > 0) {
                const desiredInContent = Object.values(this.skillTreeData.nodes).filter(node => node.GetIcon().toLowerCase().indexOf(contentType.toLowerCase()) > -1 && node.GetIcon().toLowerCase().indexOf('wheelofdisabling') === -1).filter(node => !travelNodes.includes(node))

                for (const contentNode of desiredInContent) {
                    desiredGroupDistances[contentNode.id] = desiredGroupDistances[contentNode.id] !== undefined ? desiredGroupDistances[contentNode.id] - (2 * desiredAdjustment) : 1 - (2 * desiredAdjustment);
                }
            }
        }

        for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isWormhole)) {
            desiredGroupDistances[node.id] = 1.5;
        }

        if (desiredNodes.length > 0) {
            let count = 0
            let firstPath = true;
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
                let shortestPath = paths.shift()
                if (shortestPath === undefined) {
                    if (debug) console.log('Shortest path undefined')
                    return;
                }
                //const skipped = []
                // If we're too close to the root, do it second
                while ((desiredNodes.filter(node => !node.isKeystone).length > 1 && shortestPath.path[0].isKeystone && !shortestPath.path[0].isWormhole) || desiredNodes.length > 2 && shortestPath.path[0].isNotable && (firstPath || desiredNodes.length > 3) && this.skillTreeData.tree.slice(0, 5) === 'Atlas' && Math.min(...Object.values(shortestPath.path[0].distance)) === 3) {
                    if (debug) console.log('Skip performed on ' + shortestPath.id)
                    //const shortest = shortestPath;
                    shortestPath = paths.shift();
                    //skipped.push(shortest);
                    firstPath = false;
                    if (shortestPath === undefined) {
                        if (debug) console.log('Shortest path undefined after skip')
                        return;
                    }
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
                if (debug) console.log('Yeeted ' + yeeted?.GetId())
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
            const debug = false//node.skill === 17015
            for (const nodeId of nodeIds) {
                const node = this.skillTreeData.nodes[nodeId]
                if (node.name === 'Map Drop Duplication' || node.name === 'Adjacent Map Drop Chance') continue
                if (debug) console.log(node.name)
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