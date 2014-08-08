/*global define*/
define([
        '../Core/BoundingSphere',
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/combine',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Event',
        '../Core/IndexDatatype',
        '../Core/loadArrayBuffer',
        '../Core/loadImage',
        '../Core/loadText',
        '../Core/Math',
        '../Core/Matrix2',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/PrimitiveType',
        '../Core/Quaternion',
        '../Core/Queue',
        '../Core/RuntimeError',
        '../Renderer/BufferUsage',
        '../Renderer/createShaderSource',
        '../Renderer/DrawCommand',
        '../Renderer/TextureMinificationFilter',
        '../Renderer/TextureWrap',
        '../ThirdParty/gltfDefaults',
        '../ThirdParty/Uri',
        './getModelAccessor',
        './ModelAnimationCache',
        './ModelAnimationCollection',
        './ModelMaterial',
        './ModelMesh',
        './ModelNode',
        './Pass',
        './SceneMode'
    ], function(
        BoundingSphere,
        Cartesian2,
        Cartesian3,
        Cartesian4,
        combine,
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Event,
        IndexDatatype,
        loadArrayBuffer,
        loadImage,
        loadText,
        CesiumMath,
        Matrix2,
        Matrix3,
        Matrix4,
        PrimitiveType,
        Quaternion,
        Queue,
        RuntimeError,
        BufferUsage,
        createShaderSource,
        DrawCommand,
        TextureMinificationFilter,
        TextureWrap,
        gltfDefaults,
        Uri,
        getModelAccessor,
        ModelAnimationCache,
        ModelAnimationCollection,
        ModelMaterial,
        ModelMesh,
        ModelNode,
        Pass,
        SceneMode) {
    "use strict";
    /*global WebGLRenderingContext*/

    var yUpToZUp = Matrix4.fromRotationTranslation(Matrix3.fromRotationX(-CesiumMath.PI_OVER_TWO), Cartesian3.ZERO);

    var ModelState = {
        NEEDS_LOAD : 0,
        LOADING : 1,
        LOADED : 2,
        FAILED : 3
    };

    function LoadResources() {
        this.buffersToCreate = new Queue();
        this.buffers = {};
        this.pendingBufferLoads = 0;

        this.programsToCreate = new Queue();
        this.shaders = {};
        this.pendingShaderLoads = 0;

        this.texturesToCreate = new Queue();
        this.pendingTextureLoads = 0;

        this.createSamplers = true;
        this.createSkins = true;
//        this.createRuntimeAnimations = true;
        this.createVertexArrays = true;
        this.createRenderStates = true;
        this.createUniformMaps = true;
  //      this.createRuntimeNodes = true;

        this.skinnedNodesNames = [];
    }

    LoadResources.prototype.finishedPendingLoads = function() {
        return ((this.pendingBufferLoads === 0) &&
                (this.pendingShaderLoads === 0) &&
                (this.pendingTextureLoads === 0));
    };

    LoadResources.prototype.finishedResourceCreation = function() {
        return ((this.buffersToCreate.length === 0) &&
                (this.programsToCreate.length === 0) &&
                (this.texturesToCreate.length === 0));
    };

    LoadResources.prototype.finishedBuffersCreation = function() {
        return ((this.pendingBufferLoads === 0) && (this.buffersToCreate.length === 0));
    };

    LoadResources.prototype.finishedProgramCreation = function() {
        return ((this.pendingShaderLoads === 0) && (this.programsToCreate.length === 0));
    };

    LoadResources.prototype.finishedTextureCreation = function() {
        return ((this.pendingTextureLoads === 0) && (this.texturesToCreate.length === 0));
    };

    /**
     * A 3D model based on glTF, the runtime asset format for WebGL, OpenGL ES, and OpenGL.
     * <p>
     * Cesium includes support for geometry and materials, glTF animations, and glTF skinning.
     * In addition, individual glTF nodes are pickable with {@link Scene#pick} and animatable
     * with {@link Model#getNode}.  glTF cameras and lights are not currently supported.
     * </p>
     * <p>
     * An external glTF asset is created with {@link ModelResources.fromGltf}.  glTF JSON can also be
     * created at runtime and passed to this constructor function.  In either case, the
     * {@link Model#readyToRender} event is fired when the model is ready to render, i.e.,
     * when the external binary, image, and shader files are downloaded and the WebGL
     * resources are created.
     * </p>
     *
     * @alias Model
     * @constructor
     *
     * @param {Object} [options] Object with the following properties:
     * @param {Object} [options.gltf] The object for the glTF JSON.
     * @param {String} [options.basePath=''] The base path that paths in the glTF JSON are relative to.
     * @param {Boolean} [options.show=true] Determines if the model primitive will be shown.
     * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] The 4x4 transformation matrix that transforms the model from model to world coordinates.
     * @param {Number} [options.scale=1.0] A uniform scale applied to this ModelResources.
     * @param {Number} [options.minimumPixelSize=0.0] The approximate minimum pixel size of the model regardless of zoom.
     * @param {Object} [options.id] A user-defined object to return when the model is picked with {@link Scene#pick}.
     * @param {Boolean} [options.allowPicking=true] When <code>true</code>, each glTF mesh and primitive is pickable with {@link Scene#pick}.
     * @param {Boolean} [options.asynchronous=true] Determines if model WebGL resource creation will be spread out over several frames or block until completion once all glTF files are loaded.
     * @param {Boolean} [options.debugShowBoundingVolume=false] For debugging only. Draws the bounding sphere for each draw command in the ModelResources.
     * @param {Boolean} [options.debugWireframe=false] For debugging only. Draws the model in wireframe.
     *
     * @see ModelResources.fromGltf
     * @see Model#readyToRender
     *
     * @demo {@link http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=3D%20Models.html|Cesium Sandcastle Models Demo}
     */
    var ModelResources = function(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this._gltf = gltfDefaults(options.gltf);
        this._basePath = defaultValue(options.basePath, '');

        var docUri = new Uri(document.location.href);
        var modelUri = new Uri(this._basePath);
        this._baseUri = modelUri.resolve(docUri);

        /**
         * The event fired when this model is ready to render, i.e., when the external binary, image,
         * and shader files were downloaded and the WebGL resources were created.
         * <p>
         * This event is fired at the end of the frame before the first frame the model is rendered in.
         * </p>
         *
         * @type {Event}
         * @default new Event()
         *
         * @example
         * // Play all animations at half-speed when the model is ready to render
         * ModelResources.readyToRender.addEventListener(function(modelResources) {
         *   ModelResources.activeAnimations.addAll({
         *     speedup : 0.5
         *   });
         * });
         *
         * @see Model#ready
         */
        this.readyToRender = new Event();
        this._ready = false;

        this._state = ModelState.NEEDS_LOAD;
        this._loadError = undefined;
        this._loadResources = undefined;

        this._maxDirtyNumber = 0;                  // Used in place of a dirty boolean flag to avoid an extra graph traversal

        this._runtime = {
            animations : undefined,
            rootNodes : undefined,
            nodes : undefined,            // Indexed with the node property's name, i.e., glTF id
            nodesByName : undefined,      // Indexed with name property in the node
            skinnedNodes : undefined,
            meshesByName : undefined,     // Indexed with the name property in the mesh
            materialsByName : undefined,  // Indexed with the name property in the material
            materialsById : undefined     // Indexed with the material's property name
        };

        this._rendererResources = {
            buffers : {},
            vertexArrays : {},
            programs : {},
            pickPrograms : {},
            textures : {},

            samplers : {},
            renderStates : {},
            uniformMaps : {}
        };
    };

    defineProperties(ModelResources.prototype, {
        /**
         * The object for the glTF JSON, including properties with default values omitted
         * from the JSON provided to this ModelResources.
         *
         * @memberof ModelResources.prototype
         *
         * @type {Object}
         * @readonly
         *
         * @default undefined
         */
        gltf : {
            get : function() {
                return this._gltf;
            }
        },

        /**
         * The base path that paths in the glTF JSON are relative to.  The base
         * path is the same path as the path containing the .json file
         * minus the .json file, when binary, image, and shader files are
         * in the same directory as the .json.  When this is <code>''</code>,
         * the app's base path is used.
         *
         * @memberof ModelResources.prototype
         *
         * @type {String}
         * @readonly
         *
         * @default ''
         */
        basePath : {
            get : function() {
                return this._basePath;
            }
        },

        /**
         * When <code>true</code>, this model is ready to render, i.e., the external binary, image,
         * and shader files were downloaded and the WebGL resources were created.  This is set to
         * <code>true</code> right before {@link Model#readyToRender} is fired.
         *
         * @memberof ModelResources.prototype
         *
         * @type {Boolean}
         * @readonly
         *
         * @default false
         *
         * @see Model#readyToRender
         */
        ready : {
            get : function() {
                return this._ready;
            }
        },

    });

    /**
     * Creates a model from a glTF asset.  When the model is ready to render, i.e., when the external binary, image,
     * and shader files are downloaded and the WebGL resources are created, the {@link Model#readyToRender} event is fired.
     *
     * @param {Object} options Object with the following properties:
     * @param {String} options.url The url to the glTF .json file.
     * @param {Object} [options.headers] HTTP headers to send with the request.
     * @param {Boolean} [options.show=true] Determines if the model primitive will be shown.
     * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] The 4x4 transformation matrix that transforms the model from model to world coordinates.
     * @param {Number} [options.scale=1.0] A uniform scale applied to this ModelResources.
     * @param {Number} [options.minimumPixelSize=0.0] The approximate minimum pixel size of the model regardless of zoom.
     * @param {Boolean} [options.allowPicking=true] When <code>true</code>, each glTF mesh and primitive is pickable with {@link Scene#pick}.
     * @param {Boolean} [options.asynchronous=true] Determines if model WebGL resource creation will be spread out over several frames or block until completion once all glTF files are loaded.
     * @param {Boolean} [options.debugShowBoundingVolume=false] For debugging only. Draws the bounding sphere for each {@link DrawCommand} in the ModelResources.
     * @param {Boolean} [options.debugWireframe=false] For debugging only. Draws the model in wireframe.
     * @returns {Model} The newly created ModelResources.
     *
     * @see Model#readyToRender
     *
     * @example
     * // Example 1. Create a model from a glTF asset
     * var model = scene.primitives.add(Cesium.ModelResources.fromGltf({
     *   url : './duck/duck.json'
     * }));
     *
     * @example
     * // Example 2. Create model and provide all properties and events
     * var origin = Cesium.Cartesian3.fromDegrees(-95.0, 40.0, 200000.0);
     * var modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
     *
     * var model = scene.primitives.add(ModelResources.fromGltf({
     *   url : './duck/duck.json',
     *   show : true,                     // default
     *   modelMatrix : modelMatrix,
     *   scale : 2.0,                     // double size
     *   minimumPixelSize : 128,          // never smaller than 128 pixels
     *   allowPicking : false,            // not pickable
     *   debugShowBoundingVolume : false, // default
     *   debugWireframe : false
     * }));
     *
     * ModelResources.readyToRender.addEventListener(function(modelResources) {
     *   // Play all animations when the model is ready to render
     *   ModelResources.activeAnimations.addAll();
     * });
     */
    ModelResources.fromGltf = function(options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(options) || !defined(options.url)) {
            throw new DeveloperError('options.url is required');
        }
        //>>includeEnd('debug');

        var url = options.url;
        var basePath = '';
        var i = url.lastIndexOf('/');
        if (i !== -1) {
            basePath = url.substring(0, i + 1);
        }

        var modelResources = new ModelResources(options);

        loadText(url, options.headers).then(function(data) {
            modelResources._gltf = gltfDefaults(JSON.parse(data));
            modelResources._basePath = basePath;

            var docUri = new Uri(document.location.href);
            var modelUri = new Uri(modelResources._basePath);
            modelResources._baseUri = modelUri.resolve(docUri);
        }).otherwise(getFailedLoadFunction(modelResources, 'gltf', url));

        return modelResources;
    };

    function getRuntime(modelResources, runtimeName, name) {
        //>>includeStart('debug', pragmas.debug);
        if (modelResources._state !== ModelState.LOADED) {
            throw new DeveloperError('The model is not loaded.  Wait for the model\'s readyToRender event or ready property.');
        }

        if (!defined(name)) {
            throw new DeveloperError('name is required.');
        }
        //>>includeEnd('debug');

        return (modelResources._runtime[runtimeName])[name];
    }

    /**
     * Returns the glTF node with the given <code>name</code> property.  This is used to
     * modify a node's transform for animation outside of glTF animations.
     *
     * @param {String} name The glTF name of the node.
     * @returns {ModelNode} The node or <code>undefined</code> if no node with <code>name</code> exists.
     *
     * @exception {DeveloperError} The model is not loaded.  Wait for the model's readyToRender event or ready property.
     *
     * @example
     * // Apply non-uniform scale to node LOD3sp
     * var node = ModelResources.getNode('LOD3sp');
     * node.matrix =Cesium. Matrix4.fromScale(new Cesium.Cartesian3(5.0, 1.0, 1.0), node.matrix);
     */
    ModelResources.prototype.getNode = function(name) {
        var node = getRuntime(this, 'nodesByName', name);
        return defined(node) ? node.publicNode : undefined;
    };

    /**
     * Returns the glTF mesh with the given <code>name</code> property.
     *
     * @param {String} name The glTF name of the mesh.
     *
     * @returns {ModelMesh} The mesh or <code>undefined</code> if no mesh with <code>name</code> exists.
     *
     * @exception {DeveloperError} The model is not loaded.  Wait for the model's readyToRender event or ready property.
     */
    ModelResources.prototype.getMesh = function(name) {
        return getRuntime(this, 'meshesByName', name);
    };

    /**
     * Returns the glTF material with the given <code>name</code> property.
     *
     * @param {String} name The glTF name of the material.
     * @returns {ModelMaterial} The material or <code>undefined</code> if no material with <code>name</code> exists.
     *
     * @exception {DeveloperError} The model is not loaded.  Wait for the model's readyToRender event or ready property.
     */
    ModelResources.prototype.getMaterial = function(name) {
        return getRuntime(this, 'materialsByName', name);
    };

    ///////////////////////////////////////////////////////////////////////////

    function getFailedLoadFunction(modelResources, type, path) {
        return function() {
            modelResources._loadError = new RuntimeError('Failed to load external ' + type + ': ' + path);
            modelResources._state = ModelState.FAILED;
        };
    }

    function bufferLoad(modelResources, name) {
        return function(arrayBuffer) {
            var loadResources = modelResources._loadResources;
            loadResources.buffers[name] = arrayBuffer;
            --loadResources.pendingBufferLoads;
         };
    }

    function parseBuffers(modelResources) {
        var buffers = modelResources.gltf.buffers;
        for (var name in buffers) {
            if (buffers.hasOwnProperty(name)) {
                ++modelResources._loadResources.pendingBufferLoads;
                var buffer = buffers[name];
                var uri = new Uri(buffer.uri);
                var bufferPath = uri.resolve(modelResources._baseUri).toString();
                loadArrayBuffer(bufferPath).then(bufferLoad(modelResources, name)).otherwise(getFailedLoadFunction(modelResources, 'buffer', bufferPath));
            }
        }
    }

    function parseBufferViews(modelResources) {
        var bufferViews = modelResources.gltf.bufferViews;
        for (var name in bufferViews) {
            if (bufferViews.hasOwnProperty(name)) {
                modelResources._loadResources.buffersToCreate.enqueue(name);
            }
        }
    }

    function shaderLoad(modelResources, name) {
        return function(source) {
            var loadResources = modelResources._loadResources;
            loadResources.shaders[name] = source;
            --loadResources.pendingShaderLoads;
         };
    }

    function parseShaders(modelResources) {
        var shaders = modelResources.gltf.shaders;
        for (var name in shaders) {
            if (shaders.hasOwnProperty(name)) {
                ++modelResources._loadResources.pendingShaderLoads;
                var shader = shaders[name];
                var uri = new Uri(shader.uri);
                var shaderPath = uri.resolve(modelResources._baseUri).toString();
                loadText(shaderPath).then(shaderLoad(modelResources, name)).otherwise(getFailedLoadFunction(modelResources, 'shader', shaderPath));
            }
        }
    }

    function parsePrograms(modelResources) {
        var programs = modelResources.gltf.programs;
        for (var name in programs) {
            if (programs.hasOwnProperty(name)) {
                modelResources._loadResources.programsToCreate.enqueue(name);
            }
        }
    }

    function imageLoad(modelResources, name) {
        return function(image) {
            var loadResources = modelResources._loadResources;
            --loadResources.pendingTextureLoads;
            loadResources.texturesToCreate.enqueue({
                 name : name,
                 image : image
             });
         };
    }

    function parseTextures(modelResources) {
        var images = modelResources.gltf.images;
        var textures = modelResources.gltf.textures;
        for (var name in textures) {
            if (textures.hasOwnProperty(name)) {
                ++modelResources._loadResources.pendingTextureLoads;
                var texture = textures[name];

                var uri = new Uri(images[texture.source].uri);


                var imagePath = uri.resolve(modelResources._baseUri).toString();

                loadImage(imagePath).then(imageLoad(modelResources, name)).otherwise(getFailedLoadFunction(modelResources, 'image', imagePath));
            }
        }
    }

    function parseNodes(modelResources) {
        var runtimeNodes = {};
        var runtimeNodesByName = {};
        var skinnedNodes = [];

        var skinnedNodesNames = modelResources._loadResources.skinnedNodesNames;
        var nodes = modelResources.gltf.nodes;

        for (var name in nodes) {
            if (nodes.hasOwnProperty(name)) {
                var node = nodes[name];

                var runtimeNode = {
                    // Animation targets
                    matrix : undefined,
                    translation : undefined,
                    rotation : undefined,
                    scale : undefined,

                    // Computed transforms
                    transformToRoot : new Matrix4(),
                    computedMatrix : new Matrix4(),
                    dirtyNumber : 0,                    // The frame this node was made dirty by an animation; for graph traversal

                    // Rendering
                    commands : [],                      // empty for transform, light, and camera nodes

                    // Skinned node
                    inverseBindMatrices : undefined,    // undefined when node is not skinned
                    bindShapeMatrix : undefined,        // undefined when node is not skinned or identity
                    joints : [],                        // empty when node is not skinned
                    computedJointMatrices : [],         // empty when node is not skinned

                    // Joint node
                    jointName : node.jointName,         // undefined when node is not a joint

                    // Graph pointers
                    children : [],                      // empty for leaf nodes
                    parents : [],                       // empty for root nodes

                    // Publicly-accessible ModelNode instance to modify animation targets
                    publicNode : undefined
                };
                runtimeNode.publicNode = new ModelNode(modelResources, node, runtimeNode, name);

                runtimeNodes[name] = runtimeNode;
                runtimeNodesByName[node.name] = runtimeNode;

                if (defined(node.instanceSkin)) {
                    skinnedNodesNames.push(name);
                    skinnedNodes.push(runtimeNode);
                }
            }
        }

        modelResources._runtime.nodes = runtimeNodes;
        modelResources._runtime.nodesByName = runtimeNodesByName;
        modelResources._runtime.skinnedNodes = skinnedNodes;
    }

    function parseMaterials(modelResources) {
        var runtimeMaterials = {};
        var runtimeMaterialsById = {};
        var materials = modelResources.gltf.materials;
        var rendererUniformMaps = modelResources._rendererResources.uniformMaps;

        for (var name in materials) {
            if (materials.hasOwnProperty(name)) {
                // Allocated now so ModelMaterial can keep a reference to it.
                rendererUniformMaps[name] = {
                    uniformMap : undefined,
                    values : undefined,
                    jointMatrixUniformName : undefined
                };

                var material = materials[name];
                var modelMaterial = new ModelMaterial(modelResources, material, name);
                runtimeMaterials[material.name] = modelMaterial;
                runtimeMaterialsById[name] = modelMaterial;
            }
        }

        modelResources._runtime.materialsByName = runtimeMaterials;
        modelResources._runtime.materialsById = runtimeMaterialsById;
    }

    function parseMeshes(modelResources) {
        var runtimeMeshes = {};
        var runtimeMaterialsById = modelResources._runtime.materialsById;
        var meshes = modelResources.gltf.meshes;

        for (var name in meshes) {
            if (meshes.hasOwnProperty(name)) {
                var mesh = meshes[name];
                runtimeMeshes[mesh.name] = new ModelMesh(mesh, runtimeMaterialsById, name);
            }
        }

        modelResources._runtime.meshesByName = runtimeMeshes;
    }

    function parse(modelResources) {
        parseBuffers(modelResources);
        parseBufferViews(modelResources);
        parseShaders(modelResources);
        parsePrograms(modelResources);
        parseTextures(modelResources);
        parseMaterials(modelResources);
        parseMeshes(modelResources);
        parseNodes(modelResources);
    }

    ///////////////////////////////////////////////////////////////////////////

    function createBuffers(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (loadResources.pendingBufferLoads !== 0) {
            return;
        }

        var raw;
        var bufferView;
        var bufferViews = modelResources.gltf.bufferViews;
        var buffers = loadResources.buffers;
        var rendererBuffers = modelResources._rendererResources.buffers;

        while (loadResources.buffersToCreate.length > 0) {
            var bufferViewName = loadResources.buffersToCreate.dequeue();
            bufferView = bufferViews[bufferViewName];

            if (bufferView.target === WebGLRenderingContext.ARRAY_BUFFER) {
                // Only ARRAY_BUFFER here.  ELEMENT_ARRAY_BUFFER created below.
                raw = new Uint8Array(buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
                var vertexBuffer = context.createVertexBuffer(raw, BufferUsage.STATIC_DRAW);
                vertexBuffer.vertexArrayDestroyable = false;
                rendererBuffers[bufferViewName] = vertexBuffer;
            }

            // bufferViews referencing animations are ignored here and handled in createRuntimeAnimations.
            // bufferViews referencing skins are ignored here and handled in createSkins.
        }

        // The Cesium Renderer requires knowing the datatype for an index buffer
        // at creation type, which is not part of the glTF bufferview so loop
        // through glTF accessors to create the bufferview's index buffer.
        var accessors = modelResources.gltf.accessors;
        for (var name in accessors) {
            if (accessors.hasOwnProperty(name)) {
                var accessor = accessors[name];
                bufferView = bufferViews[accessor.bufferView];

                if ((bufferView.target === WebGLRenderingContext.ELEMENT_ARRAY_BUFFER) && !defined(rendererBuffers[accessor.bufferView])) {
                    raw = new Uint8Array(buffers[bufferView.buffer], bufferView.byteOffset, bufferView.byteLength);
                    var indexBuffer = context.createIndexBuffer(raw, BufferUsage.STATIC_DRAW, accessor.componentType);
                    indexBuffer.vertexArrayDestroyable = false;
                    rendererBuffers[accessor.bufferView] = indexBuffer;
                    // In theory, several glTF accessors with different componentTypes could
                    // point to the same glTF bufferView, which would break this.
                    // In practice, it is unlikely as it will be UNSIGNED_SHORT.
                }
            }
        }
    }

    function createAttributeLocations(attributes) {
        var attributeLocations = {};
        var length = attributes.length;

        for (var i = 0; i < length; ++i) {
            attributeLocations[attributes[i]] = i;
        }

        return attributeLocations;
    }

    function createProgram(name, modelResources, context) {
        var programs = modelResources.gltf.programs;
        var shaders = modelResources._loadResources.shaders;
        var program = programs[name];

        var attributeLocations = createAttributeLocations(program.attributes);
        var vs = shaders[program.vertexShader];
        var fs = shaders[program.fragmentShader];

        modelResources._rendererResources.programs[name] = context.createShaderProgram(vs, fs, attributeLocations);

		// PERFORMANCE_IDEA: Can optimize this shader with a glTF hint. https://github.com/KhronosGroup/glTF/issues/181
		var pickFS = createShaderSource({
			sources : [fs],
			pickColorQualifier : 'uniform'
		});
		modelResources._rendererResources.pickPrograms[name] = context.createShaderProgram(vs, pickFS, attributeLocations);
    }

    function createPrograms(modelResources, context) {
        var loadResources = modelResources._loadResources;
        var name;

        if (loadResources.pendingShaderLoads !== 0) {
            return;
        }

        if (modelResources.asynchronous) {
            // Create one program per frame
            if (loadResources.programsToCreate.length > 0) {
                name = loadResources.programsToCreate.dequeue();
                createProgram(name, modelResources, context);
            }
        } else {
            // Create all loaded programs this frame
            while (loadResources.programsToCreate.length > 0) {
                name = loadResources.programsToCreate.dequeue();
                createProgram(name, modelResources, context);
            }
        }
    }

    function createSamplers(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (loadResources.createSamplers) {
            loadResources.createSamplers = false;

            var rendererSamplers = modelResources._rendererResources.samplers;
            var samplers = modelResources.gltf.samplers;
            for (var name in samplers) {
                if (samplers.hasOwnProperty(name)) {
                    var sampler = samplers[name];

                    rendererSamplers[name] = context.createSampler({
                        wrapS : sampler.wrapS,
                        wrapT : sampler.wrapT,
                        minificationFilter : sampler.minFilter,
                        magnificationFilter : sampler.magFilter
                    });
                }
            }
        }
    }

    function createTexture(gltfTexture, modelResources, context) {
        var textures = modelResources.gltf.textures;
        var texture = textures[gltfTexture.name];

        var rendererSamplers = modelResources._rendererResources.samplers;
        var sampler = rendererSamplers[texture.sampler];

        var mipmap =
            (sampler.minificationFilter === TextureMinificationFilter.NEAREST_MIPMAP_NEAREST) ||
            (sampler.minificationFilter === TextureMinificationFilter.NEAREST_MIPMAP_LINEAR) ||
            (sampler.minificationFilter === TextureMinificationFilter.LINEAR_MIPMAP_NEAREST) ||
            (sampler.minificationFilter === TextureMinificationFilter.LINEAR_MIPMAP_LINEAR);
        var requiresNpot = mipmap ||
            (sampler.wrapS === TextureWrap.REPEAT) ||
            (sampler.wrapS === TextureWrap.MIRRORED_REPEAT) ||
            (sampler.wrapT === TextureWrap.REPEAT) ||
            (sampler.wrapT === TextureWrap.MIRRORED_REPEAT);

        var source = gltfTexture.image;
        var npot = !CesiumMath.isPowerOfTwo(source.width) || !CesiumMath.isPowerOfTwo(source.height);

        if (requiresNpot && npot) {
            // WebGL requires power-of-two texture dimensions for mipmapping and REPEAT/MIRRORED_REPEAT wrap modes.
            var canvas = document.createElement('canvas');
            canvas.width = CesiumMath.nextPowerOfTwo(source.width);
            canvas.height = CesiumMath.nextPowerOfTwo(source.height);
            var canvasContext = canvas.getContext('2d');
            canvasContext.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height);
            source = canvas;
        }

        var tx;

        if (texture.target === WebGLRenderingContext.TEXTURE_2D) {
            tx = context.createTexture2D({
                source : source,
                pixelFormat : texture.internalFormat,
                pixelDatatype : texture.type,
                flipY : false
            });
        }
        // GLTF_SPEC: Support TEXTURE_CUBE_MAP.  https://github.com/KhronosGroup/glTF/issues/40

        if (mipmap) {
            tx.generateMipmap();
        }
        tx.sampler = sampler;

        modelResources._rendererResources.textures[gltfTexture.name] = tx;
    }

    function createTextures(modelResources, context) {
        var loadResources = modelResources._loadResources;
        var gltfTexture;

        if (modelResources.asynchronous) {
            // Create one texture per frame
            if (loadResources.texturesToCreate.length > 0) {
                gltfTexture = loadResources.texturesToCreate.dequeue();
                createTexture(gltfTexture, modelResources, context);
            }
        } else {
            // Create all loaded textures this frame
            while (loadResources.texturesToCreate.length > 0) {
                gltfTexture = loadResources.texturesToCreate.dequeue();
                createTexture(gltfTexture, modelResources, context);
            }
        }
    }

    function getAttributeLocations(modelResources, primitive) {
        var gltf = modelResources.gltf;
        var programs = gltf.programs;
        var techniques = gltf.techniques;
        var materials = gltf.materials;

        // Retrieve the compiled shader program to assign index values to attributes
        var attributeLocations = {};

        var technique = techniques[materials[primitive.material].instanceTechnique.technique];
        var parameters = technique.parameters;
        var pass = technique.passes[technique.pass];
        var instanceProgram = pass.instanceProgram;
        var attributes = instanceProgram.attributes;
        var programAttributeLocations = modelResources._rendererResources.programs[instanceProgram.program].vertexAttributes;

        for (var name in attributes) {
            if (attributes.hasOwnProperty(name)) {
                var parameter = parameters[attributes[name]];

                attributeLocations[parameter.semantic] = programAttributeLocations[name].index;
            }
        }

        return attributeLocations;
    }

    function searchForest(forest, jointName) {
        var length = forest.length;
        for (var i = 0; i < length; ++i) {
            var stack = [forest[i]]; // Push root node of tree

            while (stack.length > 0) {
                var n = stack.pop();

                if (n.jointName === jointName) {
                    return n;
                }

                var children = n.children;
                var childrenLength = children.length;
                for (var k = 0; k < childrenLength; ++k) {
                    stack.push(children[k]);
                }
            }
        }

        // This should never happen; the skeleton should have a node for all joints in the skin.
        return undefined;
    }

    function createJoints(modelResources, runtimeSkins) {
        var gltf = modelResources.gltf;
        var skins = gltf.skins;
        var nodes = gltf.nodes;
        var runtimeNodes = modelResources._runtime.nodes;

        var skinnedNodesNames = modelResources._loadResources.skinnedNodesNames;
        var length = skinnedNodesNames.length;
        for (var j = 0; j < length; ++j) {
            var name = skinnedNodesNames[j];
            var skinnedNode = runtimeNodes[name];
            var instanceSkin = nodes[name].instanceSkin;

            var runtimeSkin = runtimeSkins[instanceSkin.skin];
            skinnedNode.inverseBindMatrices = runtimeSkin.inverseBindMatrices;
            skinnedNode.bindShapeMatrix = runtimeSkin.bindShapeMatrix;

            // 1. Find nodes with the names in instanceSkin.skeletons (the node's skeletons)
            // 2. These nodes form the root nodes of the forest to search for each joint in skin.jointNames.  This search uses jointName, not the node's name.

            var forest = [];
            var gltfSkeletons = instanceSkin.skeletons;
            var skeletonsLength = gltfSkeletons.length;
            for (var k = 0; k < skeletonsLength; ++k) {
                forest.push(runtimeNodes[gltfSkeletons[k]]);
            }

            var gltfJointNames = skins[instanceSkin.skin].jointNames;
            var jointNamesLength = gltfJointNames.length;
            for (var i = 0; i < jointNamesLength; ++i) {
                var jointName = gltfJointNames[i];
                skinnedNode.joints.push(searchForest(forest, jointName));
            }
        }
    }

    function createSkins(modelResources) {
        var loadResources = modelResources._loadResources;

        if (!loadResources.finishedBuffersCreation()) {
            return;
        }

        if (!loadResources.createSkins) {
            return;
        }
        loadResources.createSkins = false;

        var gltf = modelResources.gltf;
        var buffers = loadResources.buffers;
        var accessors = gltf.accessors;
        var bufferViews = gltf.bufferViews;
        var skins = gltf.skins;
        var runtimeSkins = {};

        for (var name in skins) {
            if (skins.hasOwnProperty(name)) {
                var skin = skins[name];
                var accessor = accessors[skin.inverseBindMatrices];
                var bufferView = bufferViews[accessor.bufferView];

                var componentType = accessor.componentType;
                var type = accessor.type;
                var count = accessor.count;
                var typedArray = getModelAccessor(accessor).createArrayBufferView(buffers[bufferView.buffer], bufferView.byteOffset + accessor.byteOffset, count);
                var matrices =  new Array(count);

                if ((componentType === WebGLRenderingContext.FLOAT) && (type === 'MAT4')) {
                    for (var i = 0; i < count; ++i) {
                        matrices[i] = Matrix4.fromArray(typedArray, 16 * i);
                    }
                }

                var bindShapeMatrix;
                if (!Matrix4.equals(skin.bindShapeMatrix, Matrix4.IDENTITY)) {
                    bindShapeMatrix = Matrix4.clone(skin.bindShapeMatrix);
                }

                runtimeSkins[name] = {
                    inverseBindMatrices : matrices,
                    bindShapeMatrix : bindShapeMatrix // not used when undefined
                };
            }
        }

        createJoints(modelResources, runtimeSkins);
    }

    function getChannelEvaluator(modelResources, runtimeNode, targetPath, spline) {
        return function(localAnimationTime) {
//  Workaround for https://github.com/KhronosGroup/glTF/issues/219
/*
            if (targetPath === 'translation') {
                return;
            }
*/
            runtimeNode[targetPath] = spline.evaluate(localAnimationTime, runtimeNode[targetPath]);
            runtimeNode.dirtyNumber = modelResources._maxDirtyNumber;
        };
    }

    function createRuntimeAnimations(modelResources) {
        var loadResources = modelResources._loadResources;

        if (!loadResources.finishedPendingLoads()) {
            return;
        }

        if (!loadResources.createRuntimeAnimations) {
            return;
        }
        loadResources.createRuntimeAnimations = false;

        modelResources._runtime.animations = {
        };

        var runtimeNodes = modelResources._runtime.nodes;
        var animations = modelResources.gltf.animations;
        var accessors = modelResources.gltf.accessors;
        var name;

         for (var animationName in animations) {
             if (animations.hasOwnProperty(animationName)) {
                 var animation = animations[animationName];
                 var channels = animation.channels;
                 var parameters = animation.parameters;
                 var samplers = animation.samplers;

                 var parameterValues = {};

                 for (name in parameters) {
                     if (parameters.hasOwnProperty(name)) {
                         parameterValues[name] = ModelAnimationCache.getAnimationParameterValues(modelResources, accessors[parameters[name]]);
                     }
                 }

                 // Find start and stop time for the entire animation
                 var startTime = Number.MAX_VALUE;
                 var stopTime = -Number.MAX_VALUE;

                 var length = channels.length;
                 var channelEvaluators = new Array(length);

                 for (var i = 0; i < length; ++i) {
                     var channel = channels[i];
                     var target = channel.target;
                     var sampler = samplers[channel.sampler];
                     var times = parameterValues[sampler.input];

                     startTime = Math.min(startTime, times[0]);
                     stopTime = Math.max(stopTime, times[times.length - 1]);

                     var spline = ModelAnimationCache.getAnimationSpline(modelResources, animationName, animation, channel.sampler, sampler, parameterValues);
                     // GLTF_SPEC: Support more targets like materials. https://github.com/KhronosGroup/glTF/issues/142
                     channelEvaluators[i] = getChannelEvaluator(modelResources, runtimeNodes[target.id], target.path, spline);
                 }

                 modelResources._runtime.animations[animationName] = {
                     startTime : startTime,
                     stopTime : stopTime,
                     channelEvaluators : channelEvaluators
                 };
             }
         }
    }

    function createVertexArrays(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (!loadResources.finishedBuffersCreation() || !loadResources.finishedProgramCreation()) {
            return;
        }

        if (!loadResources.createVertexArrays) {
            return;
        }
        loadResources.createVertexArrays = false;

        var rendererBuffers = modelResources._rendererResources.buffers;
        var rendererVertexArrays = modelResources._rendererResources.vertexArrays;
        var gltf = modelResources.gltf;
        var accessors = gltf.accessors;
        var meshes = gltf.meshes;

        for (var meshName in meshes) {
            if (meshes.hasOwnProperty(meshName)) {
                var primitives = meshes[meshName].primitives;
                var primitivesLength = primitives.length;

                for (var i = 0; i < primitivesLength; ++i) {
                    var primitive = primitives[i];

                    // GLTF_SPEC: This does not take into account attribute arrays,
                    // indicated by when an attribute points to a parameter with a
                    // count property.
                    //
                    // https://github.com/KhronosGroup/glTF/issues/258

                    var attributeLocations = getAttributeLocations(modelResources, primitive);
                    var attrs = [];
                    var primitiveAttributes = primitive.attributes;
                    for (var attrName in primitiveAttributes) {
                        if (primitiveAttributes.hasOwnProperty(attrName)) {
                            var attributeLocation = attributeLocations[attrName];
                            // Skip if the attribute is not used by the material, e.g., because the asset was exported
                            // with an attribute that wasn't used and the asset wasn't optimized.
                            if (defined(attributeLocation)) {
                                var a = accessors[primitiveAttributes[attrName]];
                                attrs.push({
                                    index                  : attributeLocation,
                                    vertexBuffer           : rendererBuffers[a.bufferView],
                                    componentsPerAttribute : getModelAccessor(a).componentsPerAttribute,
                                    componentDatatype      : a.componentType,
                                    normalize              : false,
                                    offsetInBytes          : a.byteOffset,
                                    strideInBytes          : a.byteStride
                                });
                            }
                        }
                    }

                    var accessor = accessors[primitive.indices];
                    var indexBuffer = rendererBuffers[accessor.bufferView];
                    rendererVertexArrays[meshName + '.primitive.' + i] = context.createVertexArray(attrs, indexBuffer);
                }
            }
        }
    }

    function getBooleanStates(states) {
        // GLTF_SPEC: SAMPLE_ALPHA_TO_COVERAGE not used by Cesium
        var booleanStates = {};
        booleanStates[WebGLRenderingContext.BLEND] = false;
        booleanStates[WebGLRenderingContext.CULL_FACE] = false;
        booleanStates[WebGLRenderingContext.DEPTH_TEST] = false;
        booleanStates[WebGLRenderingContext.POLYGON_OFFSET_FILL] = false;
        booleanStates[WebGLRenderingContext.SAMPLE_COVERAGE] = false;
        booleanStates[WebGLRenderingContext.SCISSOR_TEST] = false;

        var enable = states.enable;
        var length = enable.length;
        var i;
        for (i = 0; i < length; ++i) {
            booleanStates[enable[i]] = true;
        }

        return booleanStates;
    }

    function createRenderStates(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (loadResources.createRenderStates) {
            loadResources.createRenderStates = false;
            var rendererRenderStates = modelResources._rendererResources.renderStates;
            var techniques = modelResources.gltf.techniques;
            for (var name in techniques) {
                if (techniques.hasOwnProperty(name)) {
                    var technique = techniques[name];
                    var pass = technique.passes[technique.pass];
                    var states = pass.states;

                    var booleanStates = getBooleanStates(states);
                    var statesFunctions = defaultValue(states.functions, defaultValue.EMPTY_OBJECT);
                    var blendColor = defaultValue(statesFunctions.blendColor, [0.0, 0.0, 0.0, 0.0]);
                    var blendEquationSeparate = defaultValue(statesFunctions.blendEquationSeparate, [
                        WebGLRenderingContext.FUNC_ADD,
                        WebGLRenderingContext.FUNC_ADD]);
                    var blendFuncSeparate = defaultValue(statesFunctions.blendFuncSeparate, [
                        WebGLRenderingContext.ONE,
                        WebGLRenderingContext.ONE,
                        WebGLRenderingContext.ZERO,
                        WebGLRenderingContext.ZERO]);
                    var colorMask = defaultValue(statesFunctions.colorMask, [true, true, true, true]);
                    var depthRange = defaultValue(statesFunctions.depthRange, [0.0, 1.0]);
                    var polygonOffset = defaultValue(statesFunctions.polygonOffset, [0.0, 0.0]);
                    var sampleCoverage = defaultValue(statesFunctions.sampleCoverage, [0.0, 0.0]);
                    var scissor = defaultValue(statesFunctions.scissor, [0.0, 0.0, 0.0, 0.0]);

                    rendererRenderStates[name] = context.createRenderState({
                        frontFace : defined(statesFunctions.frontFace) ? statesFunctions.frontFace[0] : WebGLRenderingContext.CCW,
                        cull : {
                            enabled : booleanStates[WebGLRenderingContext.CULL_FACE],
                            face : defined(statesFunctions.cullFace) ? statesFunctions.cullFace[0] : WebGLRenderingContext.BACK
                        },
                        lineWidth : defined(statesFunctions.lineWidth) ? statesFunctions.lineWidth[0] : 1.0,
                        polygonOffset : {
                            enabled : booleanStates[WebGLRenderingContext.POLYGON_OFFSET_FILL],
                            factor : polygonOffset[0],
                            units : polygonOffset[1]
                        },
                        scissorTest : {
                            enabled : booleanStates[WebGLRenderingContext.SCISSOR_TEST],
                            rectangle : {
                                x : scissor[0],
                                y : scissor[1],
                                width : scissor[2],
                                height : scissor[3]
                            }
                        },
                        depthRange : {
                            near : depthRange[0],
                            far : depthRange[1]
                        },
                        depthTest : {
                            enabled : booleanStates[WebGLRenderingContext.DEPTH_TEST],
                            func : defined(statesFunctions.depthFunc) ? statesFunctions.depthFunc[0] : WebGLRenderingContext.LESS
                        },
                        colorMask : {
                            red : colorMask[0],
                            green : colorMask[1],
                            blue : colorMask[2],
                            alpha : colorMask[3]
                        },
                        depthMask : defined(statesFunctions.depthMask) ? statesFunctions.depthMask[0] : true,
                        blending : {
                            enabled : booleanStates[WebGLRenderingContext.BLEND],
                            color : {
                                red : blendColor[0],
                                green : blendColor[1],
                                blue : blendColor[2],
                                alpha : blendColor[3]
                            },
                            equationRgb : blendEquationSeparate[0],
                            equationAlpha : blendEquationSeparate[1],
                            functionSourceRgb : blendFuncSeparate[0],
                            functionSourceAlpha : blendFuncSeparate[1],
                            functionDestinationRgb : blendFuncSeparate[2],
                            functionDestinationAlpha : blendFuncSeparate[3]
                        },
                        sampleCoverage : {
                            enabled : booleanStates[WebGLRenderingContext.SAMPLE_COVERAGE],
                            value : sampleCoverage[0],
                            invert : sampleCoverage[1]
                        }
                    });
                }
            }
        }
    }

    // This doesn't support LOCAL, which we could add if it is ever used.
    var gltfSemanticUniforms = {
        MODEL : function(uniformState) {
            return function() {
                return uniformState.model;
            };
        },
        VIEW : function(uniformState) {
            return function() {
                return uniformState.view;
            };
        },
        PROJECTION : function(uniformState) {
            return function() {
                return uniformState.projection;
            };
        },
        MODELVIEW : function(uniformState) {
            return function() {
                return uniformState.modelView;
            };
        },
        MODELVIEWPROJECTION : function(uniformState) {
            return function() {
                return uniformState.modelViewProjection;
            };
        },
        MODELINVERSE : function(uniformState) {
            return function() {
                return uniformState.inverseModel;
            };
        },
        VIEWINVERSE : function(uniformState) {
            return function() {
                return uniformState.inverseView;
            };
        },
        PROJECTIONINVERSE : function(uniformState) {
            return function() {
                return uniformState.inverseProjection;
            };
        },
        MODELVIEWINVERSE : function(uniformState) {
            return function() {
                return uniformState.inverseModelView;
            };
        },
        MODELVIEWPROJECTIONINVERSE : function(uniformState) {
            return function() {
                return uniformState.inverseModelViewProjection;
            };
        },
        MODELINVERSETRANSPOSE : function(uniformState) {
            return function() {
                return uniformState.inverseTranposeModel;
            };
        },
        MODELVIEWINVERSETRANSPOSE : function(uniformState) {
            return function() {
                return uniformState.normal;
            };
        },
        VIEWPORT : function(uniformState) {
            return function() {
                return uniformState.viewportCartesian4;
            };
        }
        // JOINTMATRIX created in createCommands()
    };

    ///////////////////////////////////////////////////////////////////////////

    function getScalarUniformFunction(value, model) {
        var that = {
            value : value,
            clone : function(source, result) {
                return source;
            },
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getVec2UniformFunction(value, model) {
        var that = {
            value : Cartesian2.fromArray(value),
            clone : Cartesian2.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getVec3UniformFunction(value, model) {
        var that = {
            value : Cartesian3.fromArray(value),
            clone : Cartesian3.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getVec4UniformFunction(value, model) {
        var that = {
            value : Cartesian4.fromArray(value),
            clone : Cartesian4.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getMat2UniformFunction(value, model) {
        var that = {
            value : Matrix2.fromColumnMajorArray(value),
            clone : Matrix2.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getMat3UniformFunction(value, model) {
        var that = {
            value : Matrix3.fromColumnMajorArray(value),
            clone : Matrix3.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getMat4UniformFunction(value, model) {
        var that = {
            value : Matrix4.fromColumnMajorArray(value),
            clone : Matrix4.clone,
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    function getTextureUniformFunction(value, modelResources) {
        var that = {
            value : modelResources._rendererResources.textures[value],
            clone : function(source, result) {
                return source;
            },
            func : function() {
                return that.value;
            }
        };
        return that;
    }

    var gltfUniformFunctions = {};

    // this check must use typeof, not defined, because defined doesn't work with undeclared variables.
    if (typeof WebGLRenderingContext !== 'undefined') {
        gltfUniformFunctions[WebGLRenderingContext.FLOAT] = getScalarUniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_VEC2] = getVec2UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_VEC3] = getVec3UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_VEC4] = getVec4UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.INT] = getScalarUniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.INT_VEC2] = getVec2UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.INT_VEC3] = getVec3UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.INT_VEC4] = getVec4UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.BOOL] = getScalarUniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.BOOL_VEC2] = getVec2UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.BOOL_VEC3] = getVec3UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.BOOL_VEC4] = getVec4UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_MAT2] = getMat2UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_MAT3] = getMat3UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.FLOAT_MAT4] = getMat4UniformFunction;
        gltfUniformFunctions[WebGLRenderingContext.SAMPLER_2D] = getTextureUniformFunction;
        // GLTF_SPEC: Support SAMPLER_CUBE. https://github.com/KhronosGroup/glTF/issues/40
    }

    function getUniformFunctionFromSource(source, modelResources) {
        var runtimeNode = modelResources._runtime.nodes[source];
        return function() {
            return runtimeNode.computedMatrix;
        };
    }

    function createUniformMaps(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (!loadResources.finishedTextureCreation() || !loadResources.finishedProgramCreation()) {
            return;
        }

        if (!loadResources.createUniformMaps) {
            return;
        }
        loadResources.createUniformMaps = false;

        var gltf = modelResources.gltf;
        var materials = gltf.materials;
        var techniques = gltf.techniques;
        var programs = gltf.programs;
        var rendererUniformMaps = modelResources._rendererResources.uniformMaps;

        for (var materialName in materials) {
            if (materials.hasOwnProperty(materialName)) {
                var material = materials[materialName];
                var instanceTechnique = material.instanceTechnique;
                var instanceParameters = instanceTechnique.values;
                var technique = techniques[instanceTechnique.technique];
                var parameters = technique.parameters;
                var pass = technique.passes[technique.pass];
                var instanceProgram = pass.instanceProgram;
                var uniforms = instanceProgram.uniforms;
                var activeUniforms = modelResources._rendererResources.programs[instanceProgram.program].allUniforms;

                var uniformMap = {};
                var uniformValues = {};
                var jointMatrixUniformName;

                // Uniform parameters for this pass
                for (var name in uniforms) {
                    if (uniforms.hasOwnProperty(name)) {
                        var parameterName = uniforms[name];
                        var parameter = parameters[parameterName];

                        // GLTF_SPEC: This does not take into account uniform arrays,
                        // indicated by parameters with a count property.
                        //
                        // https://github.com/KhronosGroup/glTF/issues/258

                        // GLTF_SPEC: In this implementation, material parameters with a
                        // semantic or targeted via a source (for animation) are not
                        // targetable for material animations.  Is this too strict?
                        //
                        // https://github.com/KhronosGroup/glTF/issues/142

                        if (defined(instanceParameters[parameterName])) {
                            // Parameter overrides by the instance technique
                            var uv = gltfUniformFunctions[parameter.type](instanceParameters[parameterName], modelResources);
                            uniformMap[name] = uv.func;
                            uniformValues[parameterName] = uv;
                        } else if (defined(parameter.semantic)) {
                            if (parameter.semantic !== 'JOINTMATRIX') {
                                // Map glTF semantic to Cesium automatic uniform
                                uniformMap[name] = gltfSemanticUniforms[parameter.semantic](context.uniformState);
                            } else {
                                jointMatrixUniformName = name;
                            }
                        } else if (defined(parameter.source)) {
                            uniformMap[name] = getUniformFunctionFromSource(parameter.source, modelResources);
                        } else if (defined(parameter.value)) {
                            // Technique value that isn't overridden by a material
                            var uv2 = gltfUniformFunctions[parameter.type](parameter.value, modelResources);
                            uniformMap[name] = uv2.func;
                            uniformValues[parameterName] = uv2;
                        }
                    }
                }

                var u = rendererUniformMaps[materialName];
                u.uniformMap = uniformMap;                          // uniform name -> function for the renderer
                u.values = uniformValues;                           // material parameter name -> ModelMaterial for modifying the parameter at runtime
                u.jointMatrixUniformName = jointMatrixUniformName;
            }
        }
    }

    function createPickColorFunction(color) {
        return function() {
            return color;
        };
    }

    function createJointMatricesFunction(runtimeNode) {
        return function() {
            return runtimeNode.computedJointMatrices;
        };
    }

    function createCommand(modelresources, model, gltfNode, runtimeNode, context) {

        var allowPicking = model.allowPicking;
        var runtimeMeshes = modelresources._runtime.meshesByName;

        var debugShowBoundingVolume = model.debugShowBoundingVolume;

        var resources = modelresources._rendererResources;
        var rendererVertexArrays = resources.vertexArrays;
        var rendererPrograms = resources.programs;
        var rendererPickPrograms = resources.pickPrograms;
        var rendererRenderStates = resources.renderStates;
        var rendererUniformMaps = resources.uniformMaps;

        var gltf = modelresources.gltf;
        var accessors = gltf.accessors;
        var gltfMeshes = gltf.meshes;
        var techniques = gltf.techniques;
        var materials = gltf.materials;

        var meshes = defined(gltfNode.meshes) ? gltfNode.meshes : gltfNode.instanceSkin.meshes;
        var meshesLength = meshes.length;

        for (var j = 0; j < meshesLength; ++j) {
            var name = meshes[j];
            var mesh = gltfMeshes[name];
            var primitives = mesh.primitives;
            var length = primitives.length;

            // The glTF node hierarchy is a DAG so a node can have more than one
            // parent, so a node may already have commands.  If so, append more
            // since they will have a different model matrix.

            for (var i = 0; i < length; ++i) {
                var primitive = primitives[i];
                var ix = accessors[primitive.indices];
                var instanceTechnique = materials[primitive.material].instanceTechnique;
                var technique = techniques[instanceTechnique.technique];
                var pass = technique.passes[technique.pass];
                var instanceProgram = pass.instanceProgram;

                var boundingSphere;
                var positionAttribute = primitive.attributes.POSITION;
                if (defined(positionAttribute)) {
                    var a = accessors[positionAttribute];
                    boundingSphere = BoundingSphere.fromCornerPoints(Cartesian3.fromArray(a.min), Cartesian3.fromArray(a.max));
                }

                var vertexArray = rendererVertexArrays[name + '.primitive.' + i];
                var count = ix.count;
                var offset = (ix.byteOffset / IndexDatatype.getSizeInBytes(ix.componentType));  // glTF has offset in bytes.  Cesium has offsets in indices

                var um = rendererUniformMaps[primitive.material];
                var uniformMap = um.uniformMap;
                if (defined(um.jointMatrixUniformName)) {
                    var jointUniformMap = {};
                    jointUniformMap[um.jointMatrixUniformName] = createJointMatricesFunction(runtimeNode);

                    uniformMap = combine(uniformMap, jointUniformMap);
                }

                var rs = rendererRenderStates[instanceTechnique.technique];
                // GLTF_SPEC: Offical means to determine translucency. https://github.com/KhronosGroup/glTF/issues/105
                var isTranslucent = rs.blending.enabled;
                var owner = {
                    primitive : defaultValue(modelResources.pickPrimitive, model),
                    id : modelResources.id,
                    node : runtimeNode.publicNode,
                    mesh : runtimeMeshes[mesh.name]
                };

                var command = new DrawCommand({
                    boundingVolume : new BoundingSphere(), // updated in update()
                    modelMatrix : new Matrix4(),           // computed in update()
                    primitiveType : primitive.primitive,
                    vertexArray : vertexArray,
                    count : count,
                    offset : offset,
                    shaderProgram : rendererPrograms[instanceProgram.program],
                    uniformMap : uniformMap,
                    renderState : rs,
                    owner : owner,
                    debugShowBoundingVolume : debugShowBoundingVolume,
                    pass : isTranslucent ? Pass.TRANSLUCENT : Pass.OPAQUE
                });
                model.commands.push(command);

                var pickCommand;

                if (allowPicking) {
                    var pickId = context.createPickId(owner);
                    model.pickIds.push(pickId);

                    var pickUniformMap = combine(
                        uniformMap, {
                            czm_pickColor : createPickColorFunction(pickId.color)
                        });

                    pickCommand = new DrawCommand({
                        boundingVolume : new BoundingSphere(), // updated in update()
                        modelMatrix : new Matrix4(),           // computed in update()
                        primitiveType : primitive.primitive,
                        vertexArray : vertexArray,
                        count : count,
                        offset : offset,
                        shaderProgram : rendererPickPrograms[instanceProgram.program],
                        uniformMap : pickUniformMap,
                        renderState : rs,
                        owner : owner,
                        pass : isTranslucent ? Pass.TRANSLUCENT : Pass.OPAQUE
                    });
                    model.pickCommands.push(pickCommand);
                }

                /*runtimeNode.commands.push({
                    command : command,
                    pickCommand : pickCommand,
                    boundingSphere : boundingSphere
                });*/
            }
        }
    }

    function createRuntimeNodes(modelResources, context) {
        var loadResources = modelResources._loadResources;

        if (!loadResources.finishedPendingLoads() || !loadResources.finishedResourceCreation()) {
            return;
        }

        if (!loadResources.createRuntimeNodes) {
            return;
        }
        loadResources.createRuntimeNodes = false;

        var rootNodes = [];
        var runtimeNodes = modelResources._runtime.nodes;

        var gltf = modelResources.gltf;
        var nodes = gltf.nodes;

        var scene = gltf.scenes[gltf.scene];
        var sceneNodes = scene.nodes;
        var length = sceneNodes.length;

        var stack = [];
        var axis = new Cartesian3();

        for (var i = 0; i < length; ++i) {
            stack.push({
                parentRuntimeNode : undefined,
                gltfNode : nodes[sceneNodes[i]],
                id : sceneNodes[i]
            });

            while (stack.length > 0) {
                var n = stack.pop();
                var parentRuntimeNode = n.parentRuntimeNode;
                var gltfNode = n.gltfNode;

                // Node hierarchy is a DAG so a node can have more than one parent so it may already exist
                var runtimeNode = runtimeNodes[n.id];
                if (runtimeNode.parents.length === 0) {
                    if (defined(gltfNode.matrix)) {
                        runtimeNode.matrix = Matrix4.fromColumnMajorArray(gltfNode.matrix);
                    } else {
                        // TRS converted to Cesium types
                        axis = Cartesian3.fromArray(gltfNode.rotation, 0, axis);
                        runtimeNode.translation = Cartesian3.fromArray(gltfNode.translation);
                        runtimeNode.rotation = Quaternion.fromAxisAngle(axis, gltfNode.rotation[3]);
                        runtimeNode.scale = Cartesian3.fromArray(gltfNode.scale);
                    }
                }

                if (defined(parentRuntimeNode)) {
                    parentRuntimeNode.children.push(runtimeNode);
                    runtimeNode.parents.push(parentRuntimeNode);
                } else {
                    rootNodes.push(runtimeNode);
                }

                if (defined(gltfNode.meshes) || defined(gltfNode.instanceSkin)) {
                    createCommand(modelResources, gltfNode, runtimeNode, context);
                }

                var children = gltfNode.children;
                var childrenLength = children.length;
                for (var k = 0; k < childrenLength; ++k) {
                    stack.push({
                        parentRuntimeNode : runtimeNode,
                        gltfNode : nodes[children[k]],
                        id : children[k]
                    });
                }
            }
        }

        modelResources._runtime.rootNodes = rootNodes;
        modelResources._runtime.nodes = runtimeNodes;
    }

    function createResources(modelResources, context) {
        createBuffers(modelResources, context);      // using glTF bufferViews
        createPrograms(modelResources, context);
        createSamplers(modelResources, context);
        createTextures(modelResources, context);

        createSkins(modelResources);
        createRuntimeAnimations(modelResources);
        createVertexArrays(modelResources, context); // using glTF meshes
        createRenderStates(modelResources, context); // using glTF materials/techniques/passes/states
        createUniformMaps(modelResources, context);  // using glTF materials/techniques/passes/instanceProgram
        createRuntimeNodes(modelResources, context); // using glTF scene
    }

    ///////////////////////////////////////////////////////////////////////////

    function getNodeMatrix(node, result) {
        var publicNode = node.publicNode;
        var publicMatrix = publicNode.matrix;

        if (publicNode.useMatrix && defined(publicMatrix)) {
            // Public matrix overrides orginial glTF matrix and glTF animations
            Matrix4.clone(publicMatrix, result);
        } else if (defined(node.matrix)) {
            Matrix4.clone(node.matrix, result);
        } else {
            Matrix4.fromTranslationQuaternionRotationScale(node.translation, node.rotation, node.scale, result);
        }
    }

    var scratchNodeStack = [];

    function updateNodeHierarchyModelMatrix(modelResources, modelTransformChanged, justLoaded) {
        var maxDirtyNumber = modelResources._maxDirtyNumber;
        var allowPicking = modelResources.allowPicking;

        var rootNodes = modelResources._runtime.rootNodes;
        var length = rootNodes.length;

        var nodeStack = scratchNodeStack;
        var computedModelMatrix = modelResources._computedModelMatrix;

        for (var i = 0; i < length; ++i) {
            var n = rootNodes[i];

            getNodeMatrix(n, n.transformToRoot);
            nodeStack.push(n);

            while (nodeStack.length > 0) {
                n = nodeStack.pop();
                var transformToRoot = n.transformToRoot;
                var commands = n.commands;

                if ((n.dirtyNumber === maxDirtyNumber) || modelTransformChanged || justLoaded) {
                    var commandsLength = commands.length;
                    if (commandsLength > 0) {
                        // Node has meshes, which has primitives.  Update their commands.
                        for (var j = 0 ; j < commandsLength; ++j) {
                            var primitiveCommand = commands[j];
                            var command = primitiveCommand.command;
                            Matrix4.multiplyTransformation(computedModelMatrix, transformToRoot, command.modelMatrix);

                            // PERFORMANCE_IDEA: Can use transformWithoutScale if no node up to the root has scale (inclug animation)
                            BoundingSphere.transform(primitiveCommand.boundingSphere, command.modelMatrix, command.boundingVolume);

                            if (allowPicking) {
                                var pickCommand = primitiveCommand.pickCommand;
                                Matrix4.clone(command.modelMatrix, pickCommand.modelMatrix);
                                BoundingSphere.clone(command.boundingVolume, pickCommand.boundingVolume);
                            }
                        }
                    } else {
                        // Node has a light or camera
                        n.computedMatrix = Matrix4.multiplyTransformation(computedModelMatrix, transformToRoot, n.computedMatrix);
                    }
                }

                var children = n.children;
                var childrenLength = children.length;
                for (var k = 0; k < childrenLength; ++k) {
                    var child = children[k];

                    // A node's transform needs to be updated if
                    // - It was targeted for animation this frame, or
                    // - Any of its ancestors were targeted for animation this frame

                    // PERFORMANCE_IDEA: if a child has multiple parents and only one of the parents
                    // is dirty, all the subtrees for each child instance will be dirty; we probably
                    // won't see this in the wild often.
                    child.dirtyNumber = Math.max(child.dirtyNumber, n.dirtyNumber);

                    if ((child.dirtyNumber === maxDirtyNumber) || justLoaded) {
                        // Don't check for modelTransformChanged since if only the model's model matrix changed,
                        // we do not need to rebuild the local transform-to-root, only the final
                        // [model's-model-matrix][transform-to-root] above.
                        getNodeMatrix(child, child.transformToRoot);
                        Matrix4.multiplyTransformation(transformToRoot, child.transformToRoot, child.transformToRoot);
                    }

                    nodeStack.push(child);
                }
            }
        }
        ++modelResources._maxDirtyNumber;
    }

    var scratchObjectSpace = new Matrix4();

    function applySkins(modelResources) {
        var skinnedNodes = modelResources._runtime.skinnedNodes;
        var length = skinnedNodes.length;

        for (var i = 0; i < length; ++i) {
            var node = skinnedNodes[i];

            scratchObjectSpace = Matrix4.inverseTransformation(node.transformToRoot, scratchObjectSpace);

            var computedJointMatrices = node.computedJointMatrices;
            var joints = node.joints;
            var bindShapeMatrix = node.bindShapeMatrix;
            var inverseBindMatrices = node.inverseBindMatrices;
            var inverseBindMatricesLength = inverseBindMatrices.length;

            for (var m = 0; m < inverseBindMatricesLength; ++m) {
                // [joint-matrix] = [node-to-root^-1][joint-to-root][inverse-bind][bind-shape]
                if (!defined(computedJointMatrices[m])) {
                    computedJointMatrices[m] = new Matrix4();
                }
                computedJointMatrices[m] = Matrix4.multiplyTransformation(scratchObjectSpace, joints[m].transformToRoot, computedJointMatrices[m]);
                computedJointMatrices[m] = Matrix4.multiplyTransformation(computedJointMatrices[m], inverseBindMatrices[m], computedJointMatrices[m]);
                if (defined(bindShapeMatrix)) {
                    // Optimization for when bind shape matrix is the identity.
                    computedJointMatrices[m] = Matrix4.multiplyTransformation(computedJointMatrices[m], bindShapeMatrix, computedJointMatrices[m]);
                }
            }
        }
    }

    function updatePickIds(modelResources, context) {
        var id = ModelResources.id;
        if (modelResources._id !== id) {
            modelResources._id = id;

            var pickIds = modelResources._pickIds;
            var length = pickIds.length;
            for (var i = 0; i < length; ++i) {
                pickIds[i].object.id = id;
            }
        }
    }

    function updateWireframe(modelResources) {
        if (modelResources._debugWireframe !== modelResources.debugWireframe) {
            modelResources._debugWireframe = modelResources.debugWireframe;

            // This assumes the original primitive was TRIANGLES and that the triangles
            // are connected for the wireframe to look perfect.
            var primitiveType = modelResources.debugWireframe ? PrimitiveType.LINES : PrimitiveType.TRIANGLES;
            var commands = modelResources._renderCommands;
            var length = commands.length;

            for (var i = 0; i < length; ++i) {
                commands[i].primitiveType = primitiveType;
            }
        }
    }

    /**
     * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
     * get the draw commands needed to render this primitive.
     * <p>
     * Do not call this function directly.  This is documented just to
     * list the exceptions that may be propagated when the scene is rendered:
     * </p>
     *
     * @exception {RuntimeError} Failed to load external reference.
     */
    ModelResources.prototype.update = function(context, frameState) {

        if ((this._state === ModelState.NEEDS_LOAD) && defined(this.gltf)) {
            this._state = ModelState.LOADING;
            this._loadResources = new LoadResources();
            parse(this);
        }

        var justLoaded = false;

        if (this._state === ModelState.FAILED) {
            throw this._loadError;
        }

        if (this._state === ModelState.LOADING) {
            // Incrementally create WebGL resources as buffers/shaders/textures are downloaded
            createResources(this, context);

            var loadResources = this._loadResources;
            if (loadResources.finishedPendingLoads() && loadResources.finishedResourceCreation()) {
                this._state = ModelState.LOADED;
                this._loadResources = undefined;  // Clear CPU memory since WebGL resources were created.
                justLoaded = true;
            }
        }

//            updateWireframe(this);

        if (justLoaded) {
            var modelResources = this;
            frameState.afterRender.push(function() {
                modelResources._ready = true;
                modelResources.readyToRender.raiseEvent(modelResources);
            });
            return;
        }

    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see Model#destroy
     */
    ModelResources.prototype.isDestroyed = function() {
        return false;
    };

    function destroy(property) {
        for (var name in property) {
            if (property.hasOwnProperty(name)) {
                property[name].destroy();
            }
        }
    }

    function release(property) {
        for (var name in property) {
            if (property.hasOwnProperty(name)) {
                property[name].destroy();
            }
        }
    }

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see Model#isDestroyed
     *
     * @example
     * model = model && ModelResources.destroy();
     */
    ModelResources.prototype.destroy = function() {
        var resources = this._rendererResources;
        destroy(resources.buffers);
        destroy(resources.vertexArrays);
        release(resources.programs);
        release(resources.pickPrograms);
        destroy(resources.textures);
        resources = undefined;
        this._rendererResources = undefined;

        var pickIds = this._pickIds;
        var length = pickIds.length;
        for (var i = 0; i < length; ++i) {
            pickIds[i].destroy();
        }

        return destroyObject(this);
    };

    return ModelResources;
});
