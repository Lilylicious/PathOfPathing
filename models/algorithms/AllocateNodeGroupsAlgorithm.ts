import { SkillNode, SkillNodeStates } from "../SkillNode";
import { SkillTreeData } from "../SkillTreeData";
import { IAllocationAlgorithm } from "./IAllocationAlgorithm";
import { ShortestPathToDesiredAlgorithm } from "./ShortestPathToDesiredAlgorithm";


export class AllocateNodeGroupsAlgorithm implements IAllocationAlgorithm {
    skillTreeData: SkillTreeData;
    fixedGroups: { abyssGroup: number; exarchGroup: number; }


    constructor(treeData: SkillTreeData, fixedGroups: { abyssGroup: number; exarchGroup: number; }) {
        this.skillTreeData = treeData;
        this.fixedGroups = fixedGroups;
    }

    Execute(shortestPathAlgorithm: ShortestPathToDesiredAlgorithm, maxSteps: number): void {
        const debug = false
        const nodesToDisable = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).filter(node => !node.is(SkillNodeStates.Desired) && node.classStartIndex === undefined && !node.isAscendancyStart)
        for (const node of nodesToDisable) {
            this.skillTreeData.removeState(node, SkillNodeStates.Active);
        }

        const desiredNodesUnsorted = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired))

        let nodeGroups: SkillNode[][] = [];

        for (const node of desiredNodesUnsorted) {
            this.skillTreeData.addState(node, SkillNodeStates.Active)
            nodeGroups.push([node])
        }

        let allAdjacentsMerged = false;
        while (!allAdjacentsMerged) {
            let node1: SkillNode | undefined = undefined;
            let node2: SkillNode | undefined = undefined;
            for (const group of nodeGroups) {
                for (const node of group) {
                    if (node.isMastery) continue;
                    const adjacents = [...node.in, ...node.out];
                    for (const adjacent of adjacents) {
                        const adjacentNode = this.skillTreeData.nodes[adjacent];
                        if (adjacentNode.isMastery) continue;
                        if (adjacentNode.is(SkillNodeStates.Active) && !group.includes(adjacentNode)) {
                            node1 = node;
                            node2 = adjacentNode;
                            break;
                        }
                    }

                    if (node1 && node2) break;
                }
                if (node1 && node2) break;
            }

            if (node1 && node2) {
                const originGroup = nodeGroups.find(group => group.includes(node1!))
                const targetGroup = nodeGroups.find(group => group.includes(node2!))
                const mergedGroup = this.mergeGroups(originGroup!, targetGroup!);
                nodeGroups = nodeGroups.filter(group => group.map(node => node.skill).sort().join(',') !== originGroup!.map(node => node.skill).sort().join(',') && group.map(node => node.skill).sort().join(',') != targetGroup!.map(node => node.skill).sort().join(','));
                nodeGroups.push(mergedGroup);
            } else {
                allAdjacentsMerged = true;
            }
        }


        const desiredAdjustment = 0.01;
        const desiredGroupDistances = this.adjustDesiredGroupDistances(desiredNodesUnsorted.filter(node => node.isNotable), desiredAdjustment * 3)

        for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isNotable)) {
            desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - 0.5 : 0.5;

            for (const stat of node.stats) {
                if (stat.includes('maximum Life')) desiredGroupDistances[node.skill] = desiredGroupDistances[node.skill] ? desiredGroupDistances[node.skill] - (2 * desiredAdjustment) : 1 - (2 * desiredAdjustment);
            }
        }

        const travelStats = ['0.5% chance for map drops to be duplicated', '1% increased quantity of items found in your maps', '3% increased scarabs found in your maps', '2% increased effect of modifiers on your maps', '2% chance for one monster in each of your maps to drop an additional connected map']

        for (const index in nodeGroups) {
            if (nodeGroups[index].some(node => node.classStartIndex !== undefined)) continue;

            for (const node of nodeGroups[index]) {
                const earliestMandatoryNodeId = node.earliestMandatoryNode

                if (earliestMandatoryNodeId === node.skill || (node.ascendancyName !== undefined && node.ascendancyName !== '')) {
                    continue;
                }

                const earliestMandatoryNode = this.skillTreeData.nodes[earliestMandatoryNodeId];

                if (!earliestMandatoryNode.is(SkillNodeStates.Active)) {
                    this.skillTreeData.addState(earliestMandatoryNode, SkillNodeStates.Active);

                    const adjacents = [...new Set([...earliestMandatoryNode.in, ...earliestMandatoryNode.out])]
                    let groupFound = false;
                    for (const index in nodeGroups) {
                        if (nodeGroups[index].map(groupNode => groupNode.GetId()).includes(earliestMandatoryNode.GetId()))
                            continue;

                        if (nodeGroups[index].some(groupNode => adjacents.includes(groupNode.GetId()))) {
                            nodeGroups[index].push(earliestMandatoryNode);
                            groupFound = true;
                            break;
                        }
                    }

                    if (!groupFound) {
                        nodeGroups.push([earliestMandatoryNode]);
                    }
                }
            }
        }


        const travelNodes = Object.values(this.skillTreeData.nodes).filter(node => this.skillTreeData.tree === 'Default' ? node.isRegular1 : (node.isRegular2 && node.stats.some(stat => travelStats.includes(stat.toLowerCase()))));
        for (const travelNode of travelNodes) {
            desiredGroupDistances[travelNode.id] = desiredGroupDistances[travelNode.id] !== undefined ? desiredGroupDistances[travelNode.id] - desiredAdjustment : 1 - desiredAdjustment;
        }


        if (this.skillTreeData.tree.slice(0, 5) === 'Atlas') {
            const contentTypes = ['Alva', 'Anarchy', 'Bestiary', 'Beyond', 'Blight', 'Breach', 'CleansingFire', 'Conqueror',
                'Delirium', 'Delve', 'Domination', 'ElderShaper', 'Essence', 'Expedition', 'Harbinger', 'Harvest', 'Heist',
                'Jun', 'Kirac', 'Labyrinth', 'Legion', 'Map', 'Metamorph', 'Necropolis', 'Ritual', 'Scarab', 'Sextant', 'Strongbox', 'Synthesis',
                'Tangle', 'Torment', 'Vaal']

            for (const contentType of contentTypes) {
                if (desiredNodesUnsorted.filter(node => node.GetIcon().toLowerCase().indexOf(contentType.toLowerCase()) > -1 && node.GetIcon().toLowerCase().indexOf('wheelofdisabling') === -1).filter(node => !travelNodes.includes(node)).length > 0) {
                    const desiredInContent = Object.values(this.skillTreeData.nodes).filter(node => node.GetIcon().toLowerCase().indexOf(contentType.toLowerCase()) > -1 && node.GetIcon().toLowerCase().indexOf('wheelofdisabling') === -1).filter(node => !travelNodes.includes(node))

                    for (const contentNode of desiredInContent) {
                        desiredGroupDistances[contentNode.id] = desiredGroupDistances[contentNode.id] !== undefined ? desiredGroupDistances[contentNode.id] - (2 * desiredAdjustment) : 1 - (2 * desiredAdjustment);
                    }
                }
            }

            const smallNodes = Object.values(this.skillTreeData.nodes).filter(node => node.isRegular2);

            for (const node of smallNodes) {
                let isTravelNode = false;
                for (const stat of node.stats) {
                    if (travelStats.includes(stat.toLowerCase())) {
                        isTravelNode = true;
                    }
                }

                if (isTravelNode) continue;

                const adjacent = [...new Set([...node.in, ...node.out])];

                let adjacentTravelNode = false;
                for (const id of adjacent) {
                    const adjNode = this.skillTreeData.nodes[id];
                    for (const stat of adjNode.stats) {
                        if (travelStats.includes(stat.toLowerCase())) {
                            adjacentTravelNode = true;
                        }

                        if (adjacentTravelNode) {
                            desiredGroupDistances[node.id] = desiredGroupDistances[node.id] !== undefined ? desiredGroupDistances[node.id] - desiredAdjustment : 1 - desiredAdjustment;
                            break;
                        }
                    }
                    if (adjacentTravelNode) {
                        break;
                    }
                }
            }

            for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isWormhole)) {
                desiredGroupDistances[node.id] = 1.5;
            }


            if (this.skillTreeData.nodes['65225'].is(SkillNodeStates.Desired)) {
                for (const node of Object.values(this.skillTreeData.nodes).filter(node => node.isRegular2 && node.stats.some(stat => stat.toLowerCase() === '3% increased scarabs found in your maps'))) {
                    desiredGroupDistances[node.id] = 1.1;
                }
            }

        }

        if (nodeGroups.length > 1) {
            let count = 0
            let beforeLastMerge = true;
            while (nodeGroups.length > 1) {
                if (debug) console.log('Groups length: ' + nodeGroups.length)
                if (++count > 400) {
                    console.log('Infinite loop detection triggered. Please report this as a bug.')
                    break;
                }

                //TODO: Make this automatically set when in a development environtment
                //This allows a developer to step through the allocation algorithm, which eases debugging tremendously
                const devEnv = false;
                if (devEnv && count > maxSteps) {
                    return
                }

                const paths: SkillNode[][] = [];
                const nonMasteriesLeft = nodeGroups.some(group => group.every(node => !node.isMastery))

                for (const group of nodeGroups) {

                    if ((nonMasteriesLeft && group.length === 1) && (group[0].isMastery && [...new Set([...group[0].in, ...group[0].out])].map(id => this.skillTreeData.nodes[id]).some(adjacent => adjacent.is(SkillNodeStates.Active) || adjacent.is(SkillNodeStates.Desired))))
                        continue;
                    const newPaths = shortestPathAlgorithm.Execute(this.skillTreeData, group, desiredGroupDistances, false);
                    for (const path of newPaths) {
                        if (path.length > 0)
                            paths.push(path);
                        if (debug) console.log(path.map(node => node.GetId()).join(', '))
                    }

                }

                const occurences: { [id: number]: number } = {};

                for (const path of paths) {
                    for (const node of path) {
                        if (path.indexOf(node) !== 0 && path.indexOf(node) !== path.length - 1) {
                            occurences[node.skill] = occurences[node.skill] ? occurences[node.skill] + 1 : 1
                        } else {
                            {
                                occurences[node.skill] = occurences[node.skill] ? occurences[node.skill] : 0;
                            }
                        }
                    }
                }

                function compareOccurences(a: SkillNode[], b: SkillNode[]) {
                    let sumA = a.reduce((previousSum, currentNode) => previousSum + occurences[currentNode.skill], 0) / (a.length - 2);
                    let sumB = b.reduce((previousSum, currentNode) => previousSum + occurences[currentNode.skill], 0) / (b.length - 2);

                    if (sumA === undefined || sumB === undefined) return 0;
                    if (sumA < sumB) return 1;
                    if (sumA > sumB) return -1;
                    return 0;
                }


                function compareWeights(a: SkillNode[], b: SkillNode[]) {
                    let sumA = a.reduce((sum, currentNode) => sum += currentNode.is(SkillNodeStates.Desired) || currentNode.is(SkillNodeStates.Active) ? 0 : desiredGroupDistances[currentNode.GetId()] ? desiredGroupDistances[currentNode.GetId()] : 1, 0);
                    let sumB = b.reduce((sum, currentNode) => sum += currentNode.is(SkillNodeStates.Desired) || currentNode.is(SkillNodeStates.Active) ? 0 : desiredGroupDistances[currentNode.GetId()] ? desiredGroupDistances[currentNode.GetId()] : 1, 0);

                    // If we're not merging the last two groups, shift an class starts to the end
                    if (beforeLastMerge) {
                        let aClassStart = a.some(node => node.classStartIndex !== undefined);
                        let bClassStart = b.some(node => node.classStartIndex !== undefined);
                        if (aClassStart && bClassStart) return 0;
                        if (aClassStart && !bClassStart) return 1;
                        if (!aClassStart && bClassStart) return -1;
                    }

                    if (sumA === undefined || sumB === undefined) return 0;
                    if (sumA < sumB) return -1;
                    if (sumA > sumB) return 1;
                    return 0;
                }
                paths.sort(compareOccurences)
                paths.sort(compareWeights)

                if (nodeGroups.length <= 2) beforeLastMerge = false;

                if (paths.length == 0) {
                    if (debug) console.log('No paths found')
                    break;
                }

                let shortestPath = paths.shift()
                if (shortestPath === undefined) {
                    if (debug) console.log('Shortest path undefined')
                    return;
                }

                //First node in path is always the first node in the origin group that was checked for the path, which is always active
                const groupNode = shortestPath.shift();
                if (groupNode === undefined) {
                    if (debug) console.log('First node in path undefined')
                    return;
                }
                if (debug) console.log(groupNode.GetId(), shortestPath.map(node => node.GetId()).join(', '))

                if (!groupNode.is(SkillNodeStates.Active)) {
                    if (debug) console.log('Added', groupNode.id, '(' + groupNode.name + ')')
                    this.skillTreeData.addState(groupNode, SkillNodeStates.Active);
                }

                for (const node of shortestPath) {
                    if (!node.is(SkillNodeStates.Active)) {
                        if (debug) console.log('Added', node.id, '(' + node.name + ')')
                        this.skillTreeData.addState(node, SkillNodeStates.Active);
                    }
                }

                const lastNode = shortestPath![shortestPath!.length - 1];
                if (debug) console.log('lastNode ' + lastNode.GetId())

                if (debug) console.log('Groups before merge ' + nodeGroups.length)

                const originGroup = nodeGroups.find((group => group.includes(groupNode)))
                const targetGroup = nodeGroups.find((group => group.includes(lastNode)))
                if (originGroup === undefined || targetGroup === undefined) {
                    console.log(nodeGroups)
                    console.log(originGroup, groupNode)
                    console.log(targetGroup, lastNode)
                    return;
                }
                const mergedGroup = this.mergeGroups(originGroup, targetGroup);
                nodeGroups = nodeGroups.filter(group => group.map(node => node.skill).sort().join(',') !== originGroup.map(node => node.skill).sort().join(',') && group.map(node => node.skill).sort().join(',') != targetGroup.map(node => node.skill).sort().join(','));
                if (debug) console.log(nodeGroups, originGroup, targetGroup)

                const pathNodes = shortestPath.filter(node => ![...mergedGroup].includes(node))

                const newGroup = [...mergedGroup, ...pathNodes];
                nodeGroups.push(newGroup);
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
            let frontier = [...startNodeIds]
            const explored2: { [id: string]: SkillNode } = {};
            while (frontier.length > 0) {
                const currentNode = frontier.shift();
                if (currentNode === undefined) break;
                explored2[currentNode.GetId()] = currentNode
                if (currentNode.isMastery) continue;

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
                    allDesiredFound = false;
                    break;
                }
            }

            if (!allDesiredFound) {
                requiredNodes[node.GetId()] = node;
            } else {
                const yeeted = node;
                if (yeeted === undefined) break;
                this.skillTreeData.removeState(yeeted, SkillNodeStates.Active)
            }
        }

    }

    private mergeGroups = (originGroup: SkillNode[], targetGroup: SkillNode[]): SkillNode[] => {
        if (originGroup === undefined || targetGroup === undefined) {
            console.log('Group undefined')
            console.log(originGroup)
            console.log(targetGroup)
            return new Array<SkillNode>();
        }

        return [...originGroup, ...targetGroup];

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
            const debug = false
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