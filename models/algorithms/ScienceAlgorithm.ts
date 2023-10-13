import { SkillTreeData } from "../../models/SkillTreeData";
import { SkillNode, SkillNodeStates } from "../../models/SkillNode";
import { FibonacciHeap, MaxFibonacciHeap } from "mnemonist";


export class ScienceAlgorithm {
    skillTreeData: SkillTreeData;
    initialFixedSet: PotentialTree[];

    constructor(treeData: SkillTreeData) {
        this.skillTreeData = treeData;
        
        this.initialFixedSet = []
        const nodes = Object.values(this.skillTreeData.nodes).sort((a,b) => a.skill - b.skill);
        for(const node of nodes){
            this.initialFixedSet.push(new PotentialTree(node, []))
        }
    }

    Execute(): void {
        //console.time('Prep check')
        const desiredNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired)).filter(node => !node.isAscendancyStart && node.classStartIndex === undefined).sort((a,b) => a.skill - b.skill);
        const distances: {[potentialTreeHash: string]: number} = {}
        const parent: {[potentialTreeHash: string]: PotentialTree[]} = {}

        const heap = new FibonacciHeap<PotentialTree>((a,b) => {
            const distA = distances[a.getHash()] ?? 0;
            const distB = distances[b.getHash()] ?? 0;
            return distA - distB;
        })

        const fixedSet: {[hash: string]: PotentialTree} = {}

        for(const node of desiredNodes){
            const potential = new PotentialTree(node, [node])
            heap.push(potential);
            distances[potential.getHash()] = 0
        }

        for(const potentialTree of this.initialFixedSet){
            const newPotential = new PotentialTree(potentialTree.specialNode, potentialTree.desiredNodesHit)
            fixedSet[newPotential.getHash()] = newPotential
        }

        let finalPop: PotentialTree | undefined = undefined;
        
        //console.timeEnd('Prep check')
        let checkCount = 0
        while(heap.size > 0){
            checkCount++
            //Get item with lowest distance
            const heapPop = heap.pop();
            if(heapPop === undefined) break;
            fixedSet[heapPop.getHash()] = heapPop

            //Get adjacent node IDs
            const adjacent = [...new Set([...heapPop.specialNode.out, ...heapPop.specialNode.in])].filter(nodeId => this.skillTreeData.nodes[nodeId].ascendancyName === '')

            for(const adjacentNode of adjacent){
                // New potential tree with the adjacent node but the same desired nodes
                const newPotential = new PotentialTree(this.skillTreeData.nodes[adjacentNode], heapPop.desiredNodesHit)
                // If we already have the new potential, skip
                if(fixedSet[newPotential.getHash()] !== undefined) continue;

                // Grab the distances
                const heapPopDistance = distances[heapPop.getHash()] ?? 0;
                const adjDistance = distances[newPotential.getHash()];

                // If the new potential tree doesn't have a distance, set it and it's parents
                if(adjDistance === undefined || heapPopDistance + 1 < adjDistance){
                    distances[newPotential.getHash()] = heapPopDistance + 1;
                    parent[newPotential.getHash()] = [heapPop];
                    heap.push(newPotential)
                }
            }
            
            //console.time('Fixed check')
            for(const fixedTree of Object.values(fixedSet)){
                if(fixedTree.specialNode === heapPop.specialNode){
                    
                    //console.time('Disjoint check')
                    let disjoint = true;
                    const nodesHit: {[nodeId: string]: SkillNode} = {}
                    for(const node of heapPop.desiredNodesHit){
                        nodesHit[node.skill] = node;
                    }
                    for(const node of fixedTree.desiredNodesHit){
                        if(nodesHit[node.skill] !== undefined)
                            disjoint = false;
                    }
                    //console.timeEnd('Disjoint check')

                    //console.time('New tree check')
                    if(disjoint){
                        const combined = new PotentialTree(fixedTree.specialNode, fixedTree.desiredNodesHit.concat(heapPop.desiredNodesHit));
                        const heapPopDistance = distances[heapPop.getHash()];
                        const fixedDistance = distances[fixedTree.getHash()];
                        const existingCombinedDistance = distances[combined.getHash()]
                        const combinedDistance = heapPopDistance + fixedDistance;

                        if(existingCombinedDistance === undefined || combinedDistance < existingCombinedDistance){
                            distances[combined.getHash()] = combinedDistance;
                            parent[combined.getHash()] = [fixedTree, heapPop];
                            heap.push(combined);
                        }
                    }
                    //console.timeEnd('New tree check')
                }
            }
            //console.timeEnd('Fixed check')
            
            if(heapPop.specialNode.classStartIndex === this.skillTreeData.getStartClass() && heapPop.desiredNodesHit.map(n => n.skill).join() === desiredNodes.map(n => n.skill).join()){
                finalPop = heapPop;
                break;
            }                
        }
        if(finalPop === undefined)
            return;

        let parentTrees: PotentialTree[] | undefined = parent[finalPop.getHash()];
        const path = new Set<SkillNode>().add(finalPop.specialNode);
        const parentsChecked: string[] = []
        let count2 = 0;
        console.log(checkCount)
        while (parentTrees !== undefined && count2++ < 100) {
            for(const tree of parentTrees){
                if(tree === undefined) continue;
                path.add(tree.specialNode)
                parentsChecked.push(tree.getHash())
                const nextParents: PotentialTree[] = parent[tree.getHash()]?.filter(tree => !parentsChecked.includes(tree.getHash()))
                if(nextParents === undefined) continue;
                parentTrees = nextParents;
            }
            
        }
        for(const node of path){
            if(!node.is(SkillNodeStates.Active)){
                this.skillTreeData.addState(node, SkillNodeStates.Active)
            }
        }
    }
}

class PotentialTree {
    specialNode: SkillNode;
    desiredNodesHit: SkillNode[];

    constructor(specialNode: SkillNode, desiredNodesHit: SkillNode[]){
        this.specialNode = specialNode;
        this.desiredNodesHit = desiredNodesHit.sort((a,b) => a.skill - b.skill);
    }
    
    getHash(): string {        
        return this.specialNode.skill + '-' + (this.desiredNodesHit.map(node => node.skill).sort((a,b) => Number(a) - Number(b)).join('-'))
    }
}