/*Olin Graph Program Spring 2016
**Authors: Josh Langowitz
**
**Main javascript code for handling user interaction.
*/

//Priorities: Plan to have something to show in 1 week.
//basic graphs
//deployment or install instructions
//Cosmetics


// Create the graph and all the GUI elements and interaction handlers
$(document).ready(function(){
    var height = window.innerHeight;
    var width = window.innerWidth/2;
    var svg = d3.select("#viz").append("svg")
        .attr("id", "image")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .append("g")
            .attr("id", "container")
            .append("g");
    var container = d3.select("#container");
    svg.append("rect")
        .attr("fill", "white")
        .attr("pointer-events", "all")
        .attr("width", width * 16 + "px")
        .attr("height", height * 16 + "px")
        .attr("x", width * -8 + "px")
        .attr("y", height * -8 + "px");
    graph = init_graph(svg, width, height);
    var tool = $("#select-tool").attr("data-value");

    undo_redo = new UndoRedo();

    //data to keep zoom persistent
    var zoom_data = {
        dirty: true,
        base_translate: [0, 0],
        delta_translate: [0, 0],
        base_scale: 1,
        delta_scale: 1
    };

    //clipboard for copy paste
    var clipboard = {};

    /* Sets up all the interactions for the user.
    ** There is a pattern of use here where any time we post to the server
    ** we clear interactions before sending the request
    ** and then only reenable interactions when the server responds.
    **
    */
    var setup_interaction = function() {
        //remove old interaction
        clear_interaction();

        //Keep track of which tool is selected
        $(".tools .btn").click(function() {
            tool = $(this).attr("data-value");
            setup_interaction();
        });


        //select tool interactions
        if (tool == $("#select-tool").attr("data-value")) {
            graph.bind_handler("click", "vertex", select);
            graph.bind_handler("click", "edge", select);

            if (zoom_data.dirty) {
                zoom_data.base_scale *= zoom_data.delta_scale;
                zoom_data.base_translate = array_add(zoom_data.base_translate, zoom_data.delta_translate);
                zoom_data.dirty = false;
            };

            //zoom
            container.call(d3.behavior.zoom().on("zoom", zoom));
        };

        //vertex tool interactions
        if (tool == $("#vertex-tool").attr("data-value")) {
            //Vertex add handler
            svg.on("click", place_vertex);
            //Vertex drag handler
            graph.bind_handler("mousedown", "vertex", drag_vertex);
        };

        //edge tool interactions
        if (tool == $("#edge-tool").attr("data-value")) {
            //Edge add handler
            graph.bind_handler("click", "vertex", start_edge);
            //Edge drag handler
            graph.bind_handler("mousedown", "edge", drag_edge);
        };

        //label tool interactions
        if (tool == $("#label-tool").attr("data-value")) {
            //label handler
            graph.bind_handler("click", "vertex", label_input);
        };

        //For buttons with inputs in them, don't let clicking in the inputs click the buttons.
        //Any such buttons should check for defaultPrevented before doing anything.
        $(".label-bound-wrapper").click(function(event) {
            event.preventDefault();
        });

        //Delete selected
        $("#delete-selected").click(delete_selected);

        //Complete labeling
        $("#complete-labeling").click(complete_labeling);

        //Save graph data locally
        $("#save-data").click(save_data);

        //Save graph image locally
        $("#save-image").click(save_image);

        //Upload graph data
        $("#load-data").on("change", load_data);

        //Undo/Redo
        $("#undo").click(undo);
        $("#redo").click(redo);
        
        //Copy/Paste
        $("#copy").click(copy);
        $("#paste").click(paste);

        //New grid
        $("#new-grid").click(new_grid);

        //Keybindings that are global to when the browser window has focus
        $(document).on("keyup", function(e) {
            // bind ctrl-z to undo and ctrl-shift-z to redo
            if (e.keyCode == 90 && e.ctrlKey) {
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            // bind ctrl-y to redo
            } else if (e.keyCode == 89 && e.ctrlKey) {
                redo();
            // bind ctrl-c to copy
            } else if (e.keyCode == 67 && e.ctrlKey) {
                copy();
            // bind ctrl-v to paste
            } else if (e.keyCode == 86 && e.ctrlKey) {
                paste();
            }
        });
    };

    /* Removes up all the interactions for the user. Used when server is busy to enforce server truth.
    **
    */
    var clear_interaction = function() {
        graph.clear_handlers("click", "vertex");
        graph.clear_handlers("click", "edge");
        graph.clear_handlers("mouseup", "vertex");
        graph.clear_handlers("mouseup","edge");
        graph.clear_handlers("mousedown","vertex");
        graph.clear_handlers("mousedown","edge");
        graph.clear_handlers("mouseover","vertex");
        graph.clear_handlers("mouseover","edge");

        $(".tools .btn").unbind();
        $(".interactions .btn").unbind();
        $("#load-data").on("change", null);

        svg.on("click", null);
        svg.on("mousemove", null);
        svg.on("mouseup", null);

        container.on(".zoom", null);

        $(document).off("keyup");
    }

    /* select a graph element. Used as a click handler, not for external use.
    **
    ** d - datum of the graph element selected
    ** i - index of the graph element selected
    */
    var select = function(d, i) {
        var selected = d.selected;
        var old_selection = graph.get_selection();
        if (!d3.event.shiftKey) {
            graph.clear_selection();
        }
        d.selected = !selected;
        var new_selection = graph.get_selection();
        graph.draw();
        undo_redo.register(function(is_redo) {
            select_all(is_redo ? new_selection : old_selection);
            return $.Deferred().resolve();
        })
    };

    /* select all graph elements in selection and deselect others
    **
    ** selection - javascript ovject with:
    **     edges    - list of edge indices
    **     vertices - list of vertex indices
    */
    var select_all = function(selection) {
        graph.clear_selection();
        for (var i = 0; i < selection.edges.length; i++) {
            graph.edges[selection.edges[i]].selected = true;
        }
        for (var i = 0; i < selection.vertices.length; i++) {
            graph.vertices[selection.vertices[i]].selected = true;
        }
    }

    /* Delete all selected graph elements
    **
    */
    var delete_selected = function() {
        clear_interaction();
        console.log("deleting selected");
        var selected = graph.get_selection();
        var adjacency_matrix = graph.get_adjacency_matrix();
        var location_data = graph.get_location_data();
        var labeling = graph.get_labeling().slice(); //slice to make a copy
        graph.delete_selected().done(setup_interaction);
        undo_redo.register(function(is_redo) {
            if (is_redo) {
                return graph.delete_selected();
            } else {
                console.log(labeling);
                return graph.new(adjacency_matrix, location_data, labeling.slice()).then(function() {
                    select_all(selected);
                });
            }
        });
    };

    /* download a file 
    **
    ** text - content of the file
    ** name - name of the file
    ** type - type of the file
    */
    var download = function(text, name, type) {
        var a = document.createElement("a");
        var file = new Blob([text], {type: type});
        a.href = URL.createObjectURL(file);
        a.download = name;
        a.click();
    }

    /* Get distance between points
    **
    ** v1 - vector in cartesian coordinates
    ** v2 - vector in cartesian coordinates
    */
    var distance = function(v1, v2) {
        return Math.sqrt(Math.pow(v1[0]-v2[0],2),Math.pow(v1[1]-v2[1],2));
    }

    /* Convert to polar 
    **
    ** v - vector in cartesian coordinates
    */
    var cartesian_to_polar = function(v) {
        var x = v[0];
        var y = v[1];
        var mag = Math.sqrt(Math.pow(x,2) + Math.pow(y,2));
        var phase = Math.atan2(y, x);
        return [mag, phase];
    }

    /* Convert to cartesian 
    **
    ** v - vector in polar coordinates
    */
    var polar_to_cartesian = function(v) {
        var mag = v[0];
        var phase = v[1];
        var x = mag * Math.cos(phase);
        var y = mag * Math.sin(phase);
        // console.log(mag, phase);
        // console.log(x, y);
        return [x, y];
    }

    /* Snap to the nearest angle  
    **
    ** angle  - angle to round
    ** angles - number of evenly-spaced, snappable angles
    */
    var snap_to_angle = function(angle, angles) {
        var round = Math.round(angle * angles / 2 / Math.PI);
        // console.log(angle, angles);
        console.log(round);
        return round / angles * 2 * Math.PI;
    }

    /* Add two arrays elementwise
    **
    ** a - first array
    ** b - second array, should be same length
    **
    ** RETURNS elementwise sum of the arrays
    */
    var array_add = function(a, b) {
        res = [];
        for (var i = 0; i < a.length; i++) {
            res.push(a[i] + b[i]);
        };
        return res
    }

    /* Undo last registered action
    **
    */
    var undo = function() {
        if (undo_redo.hasUndo()) {
            console.log("undo");
            clear_interaction();
            undo_redo.undo().done(function(){
                graph.draw();
                setup_interaction();
            });
        }
    }

    /* Redo last registered action
    **
    */
    var redo = function() {
        if (undo_redo.hasRedo()) {
            console.log("redo");
            clear_interaction();
            undo_redo.redo().done(function(){
                graph.draw();
                setup_interaction();
            });
        }
    }

    /* Copy selection to clipboard
    **
    */
    var copy = function() {
        var selection = graph.get_selection();
        var vertices = [];
        var edges = [];
        var labels = []
        for (var i = 0; i < selection.vertices.length; i++) {
            var v = graph.vertices[selection.vertices[i]];
            vertices.push({x: v.x, y: v.y})
            labels.push(graph.labeling[selection.vertices[i]]);
        }
        for (var i = 0; i < selection.edges.length; i++) {
            var e = graph.edges[selection.edges[i]];
            // Behavior is to ignore edges if we didn't have both vertices selected
            // to avoid trying to paste edges to vertices that don't exist.
            // We also need to update vertex indices in edges to reflect that we are making a copy.
            var v1 = selection.vertices.indexOf(e.v1);
            var v2 = selection.vertices.indexOf(e.v2);
            if (v1 >= 0 && v2 >= 0) {
                edges.push({v1: v1, v2: v2});
            }
        }
        clipboard = {edges: edges, vertices: vertices, labels: labels};
    }

    /* Paste a copy of the clipboard
    **
    */
    var paste = function() {
        var num_verts = graph.vertices.length;

        //Deep copy for redo
        var vertices = [];
        var edges = [];
        var labels = []
        for (var i = 0; i < clipboard.vertices.length; i++) {
            var v = clipboard.vertices[i];
            vertices.push({x: v.x, y: v.y})
            labels.push(clipboard.labels[i]);
        }
        for (var i = 0; i < clipboard.edges.length; i++) {
            var e = clipboard.edges[i];
            //Have the new edges correspond to the new vertices.
            edges.push({v1: e.v1 + num_verts, v2: e.v2 + num_verts});
        }

        var selected = graph.get_selection();
        var adjacency_matrix = graph.get_adjacency_matrix();
        var location_data = graph.get_location_data();
        var labeling = graph.get_labeling().slice(); //slice to make a copy

        clear_interaction();
        graph.add_many(vertices, edges, labels).done(setup_interaction);
        undo_redo.register(function(is_redo) {
            if (is_redo) {
                return graph.add_many(vertices, edges, labels);
            } else {
                return graph.new(adjacency_matrix, location_data, labeling.slice()).then(function() {
                    select_all(selected);
                });
            }
        });
    }

    /* Handler for pan and zoom
    **
    */
    var zoom = function() {
        if (!d3.event.defaultPrevented) {
            console.log("zooming");
            zoom_data.delta_translate = d3.event.translate;
            zoom_data.delta_scale = d3.event.scale;
            svg.attr("transform", "translate(" + array_add(zoom_data.base_translate, zoom_data.delta_translate) + ")scale(" + zoom_data.base_scale * zoom_data.delta_scale + ")");
            zoom_data.dirty = true;
            console.log(svg.attr("transform"));
        }
    };

    /* Handler for placing a vertex
    **
    */
    var place_vertex = function() {
        if (!d3.event.defaultPrevented) {
            var coords = d3.mouse(this);
            var x = coords[0];
            var y = coords[1];
            clear_interaction();
            graph.add_vertex(x, y).done(setup_interaction);
            undo_redo.register(function(is_redo) {
                if (is_redo) {
                    return graph.add_vertex(x, y);
                }
                return graph.remove_vertex(graph.vertices.length - 1);
            });
        };
    };

    /* Handler for dragging a vertex
    **
    */
    var drag_vertex = function(v, i, ele) {
        var old_x = v.x;
        var old_y = v.y;
        var x = v.x;
        var y = v.y;
        svg.on("mousemove", function() {
            var coords = d3.mouse(this);
            x = coords[0];
            y = coords[1];
            v.x = x;
            v.y = y;
            graph.draw();
            // console.log("we in mousemove");
        });
        graph.bind_handler("mouseup", "vertex", function() {
            undo_redo.register(function(is_redo) {
                graph.vertices[i].x = is_redo ? x : old_x;
                graph.vertices[i].y = is_redo ? y : old_y;
                return $.Deferred().resolve();
            });
            console.log("drag over");
            setup_interaction();
        });
    };

    /* Handler for starting an edge placement
    **
    */
    var start_edge = function(v, i) {
        //make a line
        svg.append("line")
            .attr("stroke", "black")
            .attr("stroke-width", 3)
            .attr("opacity", .5)
            .attr("x1", v.x)
            .attr("y1", v.y)
            .attr("x2", v.x)
            .attr("y2", v.y)
            .attr("pointer-events", "none");

        //have the line follow the mouse
        svg.on("mousemove", line_follow);

        //change vertex click handlers to add an edge to next clicked vertex
        graph.clear_handlers("click", "vertex");
        graph.bind_handler("click", "vertex", function(v2, j) {
            //if we clicked a different vertex, add the edge
            if(i != j) {
                clear_interaction();
                graph.add_edge(i, j).done(clear_line);
                undo_redo.register(function(is_redo) {
                    if (is_redo) {
                        return graph.add_edge(i, j);
                    } else {
                        return graph.remove_edge(graph.edges.length - 1);
                    }
                });
            } else {
                //we are done, clear the line
                clear_line();
            }
        });

        //if you click on nothing, clear the line and reset interactions
        svg.on("click", function() {
            if (!d3.event.defaultPrevented) {
                clear_line();
            };
        });
    };

    /* Removes the edge line from the svg and sets up interaction.
    **
    */
    var clear_line = function() {
        svg.select("line").remove();
        setup_interaction();
    };

    /* Has the line for an edge follow the mouse.
    **
    */
    var line_follow = function() {
        var coords = d3.mouse(this);
        var x = coords[0];
        var y = coords[1];
        svg.select("line").attr("x2", x).attr("y2", y);
    }

    /* Handler for dragging an edge to pivot around a vertex
    **
    */
    var drag_edge = function(e, i, ele) {
        var coords = d3.mouse(ele);

        //Store these for undo
        var x1 = graph.vertices[e.v1].x;
        var x2 = graph.vertices[e.v2].x;
        var y1 = graph.vertices[e.v1].y;
        var y2 = graph.vertices[e.v2].y;
        var diff = [0,0];

        //Whether to rotate around v1
        var fix_v1 = distance(coords, [x1, y1]) < distance(coords, [x2, y2]);
        var v1 = fix_v1 ? graph.vertices[e.v2] : graph.vertices[e.v1];
        var v2 = fix_v1 ? graph.vertices[e.v1] : graph.vertices[e.v2];

        //Rotate around edge as mouse moves
        svg.on("mousemove", function() {
            var coords = d3.mouse(this);
            var mag = cartesian_to_polar([v2.x - v1.x, v2.y -v1.y])[0];
            var x = coords[0] - v1.x;
            var y = coords[1] - v1.y;
            var angle = snap_to_angle(cartesian_to_polar([x,y])[1], 8);
            diff = polar_to_cartesian([mag, angle]);
            v2.x = v1.x + diff[0];
            v2.y = v1.y + diff[1];
            graph.draw();
        })

        //Finalize the new positions on mouse up by registering with undo_redo
        svg.on("mouseup", function() {
            undo_redo.register(function(is_redo) {
                var v1 = fix_v1 ? graph.vertices[e.v2] : graph.vertices[e.v1];
                var v2 = fix_v1 ? graph.vertices[e.v1] : graph.vertices[e.v2];
                if (is_redo) {
                    v2.x = v1.x + diff[0];
                    v2.y = v1.y + diff[1];
                } else {
                    graph.vertices[e.v1].x = x1;
                    graph.vertices[e.v1].y = y1;
                    graph.vertices[e.v2].x = x2;
                    graph.vertices[e.v2].y = y2;
                }
                return $.Deferred().resolve();
            });
            setup_interaction();
        });
    };

    /* Handler for showing the label input and changing labels
    **
    */
    var label_input = function(v, i, ele) {
        d3.select(ele).append("foreignObject")
            .attr("x", -8)
            .attr("y", -13)
            .append("xhtml:div")
                .html("<input id=label type=text>")
                //don't let things propagate to the vertex underneath
                .on("click", function() { d3.event.stopPropagation(); })
                .on("mouseup", function() { d3.event.stopPropagation(); })
                .on("mousedown", function() { d3.event.stopPropagation(); });
        $("#label").focus()
        // When you type a key, check if it's enter and if so submit the label
        // if it's escape, make the label null
        .keyup(function(e) {
            var old_label = graph.labeling[i];
            var submitting = false;
            var label = $(this).val();
            //13 is the enter key
            if (e.keyCode == 13) {
                if (label == "") {
                    label = null;
                    submitting = true;
                }
                if (label.match(/^\d+$/) !== null) {
                    label = parseInt(label);
                    submitting = true;
                } else {
                    alert("Label things using number only please!"); //TODO make this alert something prettier
                };
            };
            //27 is the escape key, on escape unlabel the vertex
            if (e.keyCode == 27) {
                label = null;
                submitting = true;
            };
            if (submitting) {
                clear_interaction();
                graph.label(label, i).done(function() {
                    graph.draw();
                    setup_interaction();
                });
                undo_redo.register(function(is_redo) {
                    var redo_label = is_redo ? label : old_label;
                    return graph.label(redo_label, i);
                });
            }
        })
        //When clicking away, cancel the labeling, leaving the old one in place
        .on("focusout", function() {
            $(this).remove();
        })
    };

    /* complete the labeling using the backend algorithm
    **
    */
    var complete_labeling = function(event) {
        if (!event.isDefaultPrevented()) {
            clear_interaction();
            console.log("completing labeling");
            var min = $("#label-min").val();
            var max = $("#label-max").val();
            var old_labeling = graph.get_labeling().slice();
            graph.complete_labeling(min, max).done(function() {
                var new_labeling = graph.get_labeling().slice();
                undo_redo.register(function(is_redo) {
                    var labeling = is_redo ? new_labeling : old_labeling;
                    console.log(labeling);
                    return graph.set_labeling(labeling.slice());
                })
                setup_interaction();
            });
        }
    };

    /* download the graph data in json format.
    **
    */
    var save_data = function() {
        var adjacency_matrix = graph.get_adjacency_matrix();
        var location_data = graph.get_location_data();
        var labeling = graph.get_labeling();
        console.log(adjacency_matrix);
        download(JSON.stringify({
            adjacency_matrix: adjacency_matrix,
            location_data: location_data,
            labeling: labeling
        }), "graph.json", "application/json");
    };

    /* upload the graph data in json format.
    **
    */
    var load_data = function() {
        console.log("on change");
        var file = this.files[0];
        console.log(file);
        fr = new FileReader();
        fr.onload = function() {
            console.log(fr.result);
            var data = JSON.parse(fr.result);
            var adjacency_matrix = data.adjacency_matrix;
            var location_data = data.location_data;
            var labeling = data.labeling;
            console.log(data);
            clear_interaction();
            graph.new(adjacency_matrix, location_data, labeling).done(function() {
                console.log(labeling);
                console.log("Here");
                console.log(graph.labeling);
                graph.draw();
                setup_interaction();
            });
        };
        fr.readAsText(file);
    };

    /* download the graph in svg format.
    **
    */
    var save_image = function() {
        var data = (new XMLSerializer()).serializeToString(d3.select("#image").node());
        download([data], "graph.svg", "'image/svg+xml;charset=utf-8'");
    };

    /* handler for creating a new grid graph.
    **
    */
    var new_grid = function(event) {
        if (!event.isDefaultPrevented()) {
            clear_interaction();
            console.log("completing labeling");
            var rows = $("#grid-rows").val();
            var columns = $("#grid-columns").val();
            var selected = graph.get_selection();
            var adjacency_matrix = graph.get_adjacency_matrix();
            var location_data = graph.get_location_data();
            var labeling = graph.get_labeling().slice(); //slice to make a copy
            graph.new_grid(rows, columns, width, height).done(setup_interaction);
            undo_redo.register(function(is_redo) {
                if (is_redo) {
                    return graph.new_grid(rows, columns, width, height);
                } else {
                    console.log(labeling);
                    return graph.new(adjacency_matrix, location_data, labeling.slice()).then(function() {
                        select_all(selected);
                    });
                }
            });
        }
    };

    //Create the graph and setup interaction
    graph.new().done(setup_interaction);
});