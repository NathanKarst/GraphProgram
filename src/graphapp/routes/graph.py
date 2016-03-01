"""
Olin Graph Program Spring 2016
Authors: Josh Langowitz
Python 3

This module contains the persistent graph object and the Flask graph Blueprint.
"""
#Flask imports
from flask import Blueprint, request

# Graphlib imports
from graphlib.graph import Graph
from graphlib.labeling import Labeling

# Graphapp imports
import graphapp.routes.labeling as l

# EXPORTS:
graph = Graph()
graph_blueprint = Blueprint("graph", __name__)

###############################################################################

# ROUTES:
@graph_blueprint.route("/new", methods=['POST'])
def new():
    graph = Graph(request.form.get("adj", []))
    l.labeling = Labeling([None] * graph.num_verts())
    return "new graph created"

@graph_blueprint.route("/new/from_adjacency_matrix", methods=['POST'])
def new_from_adjacency_matrix():
    graph = Graph.new_from_adjacency_matrix(request.form["adj"])
    l.labeling = Labeling(graph.num_verts())
    return "new graph created"

@graph_blueprint.route("/new/grid", methods=['POST'])
def new_grid():
    graph = Graph.new_grid(request.form["r"], request.form["c"], request.form["wrap"])
    l.labeling = Labeling(graph.num_verts())
    return "new graph created"

@graph_blueprint.route("/new/cycle", methods=['POST'])
def new_cycle():
    graph = Graph.new_cycle(request.form["v"])
    l.labeling = Labeling(graph.num_verts())
    return "new graph created"

@graph_blueprint.route("/vertex/add", methods=['POST'])
def add_vertex():
    graph.add_vertex()
    print(l.labeling)
    l.labeling.add_vertex()
    print(graph.adjacency_list)
    return "vertex added"

@graph_blueprint.route("/edge/add", methods=['POST'])
def add_edge():
    graph.add_edge(int(request.form["v1"]), int(request.form["v2"]))
    return "edge added"

@graph_blueprint.route("/vertex/remove", methods=['POST'])
def remove_vertex():
    graph.remove_vertex(request.form["v"])
    l.labeling.remove_vertex(request.form["v"])
    return "vertex removed"

@graph_blueprint.route("/edge/remove", methods=['POST'])
def remove_edge():
    graph.remove_edge(request.form["v1"], request.form["v2"])
    return "edge removed"

@graph_blueprint.route("/connect", methods=['POST'])
def connect_vertices():
    graph.connect(request.form["vs"])
    return "vertices connected"
