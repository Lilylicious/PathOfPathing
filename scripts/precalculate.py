import sys
import json


def main(path):
    if path[-1] != '/':
        path = path + '/'
    path = path + 'SkillTree.json'

    with open(path) as f:
        data = json.load(f)

    travel_stats = ['0.5% chance for map drops to be duplicated',
                    '1% increased Quantity of Items found in your Maps', '3% increased Scarabs found in your Maps',
                    '2% increased effect of Explicit Modifiers on your Maps',
                    '2% chance for one Monster in each of your Maps to drop an additional connected Map',
                    '+10 to Strength', '+10 to Intelligence', '+10 to Dexterity']

    nodes = data['nodes']
    node_ids = list(nodes.keys())
    print("Checking " + str(len(node_ids)) + " nodes")
    for node_id in node_ids:
        print("Checking " + str(node_id))
        if node_id == 'root':
            print("Root node skipped")
            continue

        node = nodes[node_id]

        if data['tree'][0:5] != 'Atlas' and 'ascendancyName' in node:
            print('Skipping ascendancy node')
            continue

        if 'in' not in node and 'out' not in node:
            print("Skipping no adjacent nodes")
            continue

        frontier = [node]
        exit_nodes = []
        visited = [node_id]
        earliest_mandatory_node = -1
        split_found = False
        while frontier:
            frontier_node = frontier.pop(0)
            adjacent = [x for x in frontier_node['in'] if x not in visited]
            adjacent.extend(x for x in frontier_node['out'] if x not in adjacent and x not in visited)

            print('Checking ' + str(node_id)
                  + ' against ' + str(frontier_node['skill'])
                  + ' that has ' + str(len(adjacent)) + ' adjacencies')

            if not split_found:
                earliest_mandatory_node = frontier_node['skill']
                if len(adjacent) > 1:
                    split_found = True

            for adjacent_id in adjacent:
                adjacent_node = nodes[adjacent_id]
                stats = adjacent_node['stats']
                travel = any(stat in stats for stat in travel_stats)
                if travel:
                    exit_nodes.append(adjacent_id)
                    print("Found exitnode")
                else:
                    frontier.append(adjacent_node)
                    visited.append(adjacent_id)
        if len(exit_nodes) == 1:
            nodes[node_id]['earliestMandatoryNode'] = exit_nodes[0]
        else:
            nodes[node_id]['earliestMandatoryNode'] = earliest_mandatory_node

    with open(path, 'w') as f:
        f.write(json.dumps(data, indent=4))
    print("Done")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        main('../dist/data/skill-trees/3.25.0')
    else:
        main(sys.argv[1])
