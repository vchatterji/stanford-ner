import * as childProcess from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as _ from "lodash";
import {FileNotFoundError} from "./FileNotFoundError";
import * as natural from "natural";
import * as events from "events";
import * as uuid from "node-uuid";

/**
 * Options for the NER
 */
export interface NEROptions {
    /**
     * Absolute path to the Stanford NER directory.
     * Default: The folder bundled in the NPM
     */
    installPath: string;
    /**
     * The jar file for Stanford NER
     * Default: stanford-ner.jar
     */
    jar: string;
    /**
     * The classifier to use
     * Default: english.all.3class.distsim.crf.ser.gz
     */
    classifier: string;
}

/**
 * Wraps the Stanford NER and provides interfaces for classifiecation
 */
export class NER {
    /**
     * The options object with defaults set
     */
    private options: NEROptions = {
        //This script compiles to ./dist/src hence ../../stanford-ner-2015-12-09
        installPath: path.join(__dirname, "../../stanford-ner-2015-12-09"),
        jar: "stanford-ner.jar",
        classifier: "english.all.3class.distsim.crf.ser.gz"
    };

    /**
     * The child process through which we will interact with the underlying NER implementation
     */
    private childProcess: childProcess.ChildProcess;

    /**
     * Checks that all paths to the required files can be resolved
     */
    private checkPaths() {
        const classifierPath = path.normalize(path.join(this.options.installPath, "classifiers", this.options.classifier));
        
        if(!fs.existsSync(classifierPath)) {
            throw new FileNotFoundError("Classifier could not be found at path:" + classifierPath);
        }

        const jarPath = path.normalize(path.join(this.options.installPath, this.options.jar));
        if(!fs.existsSync(jarPath)) {
            throw new FileNotFoundError("NER Jar could not be found at path:" + jarPath);
        }
    }

    /**
     * Spawns the Stanford NER as a Java process
     */
    private spawnProcess() {
        const isWin = /^win/.test(process.platform);
        this.childProcess = childProcess.spawn(
            "java",
            [
                "-mx1500m",
                "-cp",
                path.normalize(path.join(this.options.installPath, this.options.jar)) + 
                    (isWin ? ";" : ":") + path.normalize(path.join(this.options.installPath, "/lib/*")),
                "edu.stanford.nlp.ie.crf.CRFClassifier",
                "-loadClassifier",
                path.normalize(path.join(this.options.installPath, "classifiers", this.options.classifier)),
                "-readStdin"
            ]
        );

        this.childProcess.stdout.setEncoding("utf8");
    
        /**
         * Kill the child process on Control + C
         */
        process.on('SIGINT', () => {
            this.childProcess.kill();
        });

        /**
         * Kill the child process on SIGTERM
         */
        process.on('SIGTERM', () => {
            this.childProcess.kill();
        });
    }

    /**
     * Constructor
     * @param {string} installPath (Optional) Relative or absolute path to the Stanford NER directory. Default: ./stanford-ner-2015-12-09
     * @param {string} jar (Optional) The jar file for Stanford NER. Default: stanford-ner.jar
     * @param {string} classifier (Optional) The classifier to use. Default: english.all.3class.distsim.crf.ser.gz
     */
    constructor(installPath?: string, jar?: string, classifier?: string) {
        if(installPath) {
            installPath = installPath.trim();
            this.options.installPath = installPath;
        }

        if(jar) {
            jar = jar.trim();
            this.options.jar = jar;
        }

        if(classifier) {
            classifier = classifier.trim();
            this.options.classifier = classifier;
        }

        this.checkPaths();

        this.spawnProcess();
    }

    /**
     * Parses the tagged output from the NER into a Javascript object.
     * Adapted from: https://github.com/26medias/node-ner/blob/master/node-ner.js
     */
    private parse = function(parsed: string) {
        const tokenized = parsed.split(/\s/gmi);
        const splitRegex = new RegExp('(.+)/([A-Z]+)','g');
        
        let tagged = _.map(tokenized, function(token) {
            const parts = new RegExp('(.+)/([A-Z]+)','g').exec(token);
            if (parts) {
                return {
                    w:	parts[1],
                    t:	parts[2]
                }
            }
            return null;
        });
        
        tagged = _.compact(tagged);
        
        // Now we extract the neighbors into one entity
        const entities: Map<string, string[]> = new Map<string, string[]>();
        const l = tagged.length;
        let prevEntity: string = undefined;
        let entityBuffer: string[] = [];
        for (let i = 0; i < l; i++) {
            if (tagged[i].t != 'O') {
                if (tagged[i].t != prevEntity) {
                    // New tag!
                    // Was there a buffer?
                    if (entityBuffer.length > 0) {
                        // There was! We save the entity
                        if (!entities.get(prevEntity)) {
                            entities.set(prevEntity, []);
                        }
                        entities.get(prevEntity).push(entityBuffer.join(' '));
                        // Now we set the buffer
                        entityBuffer = [];
                    }
                    // Push to the buffer
                    entityBuffer.push(tagged[i].w);
                } else {
                    // Prev entity is same a current one. We push to the buffer.
                    entityBuffer.push(tagged[i].w);
                }
            } else {
                if (entityBuffer.length>0) {
                    // There was! We save the entity
                    if (!entities.get(prevEntity)) {
                        entities.set(prevEntity, []);
                    }
                    entities.get(prevEntity).push(entityBuffer.join(' '));
                    // Now we set the buffer
                    entityBuffer = [];
                }
            }
            // Save the current entity
            prevEntity = tagged[i].t;
        }
        
        //If entity buffer is not empty, then add the last entries
        if(entityBuffer.length) {
            entities.set(prevEntity, entityBuffer);
        }
        return entities;
    }

    /**
     * Gets the token count of a piece of text ignoring single character tokens
     * @param {string} text The text to token count
     * @param {boolean} isTagged (Optional) Whether the text is tagged
     */
    private getTokenCount(text: string, isTagged?:boolean) {
        const tokenizer = new natural.TreebankWordTokenizer();
        let textTokens: string[];
        
        if(isTagged) {
            textTokens = text.split(" ");
            textTokens = textTokens.map((val: string) => {
                const parts = val.split("/");
                if(parts[0] === "``") {
                    return "'"
                }
                if(parts[0] === "\'\'") {
                    return "'";
                }
                if(parts[0] === "-LRB-") {
                    return "(";
                }
                if(parts[0] === "-RRB-") {
                    return ")";
                }
                if(parts[0] === "-LSB-") {
                    return "[";
                }
                if(parts[0] === "-RSB-") {
                    return "]";
                }
                if(parts[0] === "-LCB-") {
                    return "{";
                }
                if(parts[0] === "-RCB-") {
                    return "}";
                }
                return parts[0];
            });
        }
        else {
            textTokens = tokenizer.tokenize(text);
        }
         
        const filtered = textTokens.filter((value: string) => {
            if(isTagged) {
                const parts = value.split("/");
                value = parts[0].trim();
            }
            if(value.length > 1) {
                return true;
            }
            return false;
        });
        
        return filtered.length;
    }

    /**
     * Whether an entity is currently being extracted
     */
    private isBusy = false;

    private finishedEmitter = new events.EventEmitter();

    private queue: string[] = [];

    private extract(text: string, resolve: (value: Map<string, string[]>[]) => void) {
        let numTokens = this.getTokenCount(text);
        
        const result: Map<string, string[]>[] = []
        this.childProcess.stdout.on("data", (data: string) => {
            data = data.trim();
            const sentences = data.split("\n");
            sentences.forEach((sentence) => {
                numTokens -= this.getTokenCount(sentence, true);
                const parsed = this.parse(sentence);
                result.push(parsed);
                
                if(numTokens <= 0) {
                    this.childProcess.stdout.removeAllListeners();
                    this.isBusy = false;
                    resolve(result);
                    if(this.queue.length) {
                        const nextEvent = this.queue.shift();
                        this.finishedEmitter.emit(nextEvent);
                    }
                }
            });
        });

        //Remove any CR+LF from the text.
        text = text.trim(); 

        //Then add one last one
        text += "\n"
        this.childProcess.stdin.write(text);
    }

    /**
     * Returns an array (one row per sentence) that has a Map from a Named Entity to an array containing all entities in the sentence that were classified as that Named Entity type.
     * @param {string} text The text to be processed. Should not contain any new line characters.
     */
    public async getEntities(text: string): Promise<Map<string, string[]>[]> {
        if(this.isBusy) {
            const requestId = uuid.v4();
            this.queue.push(requestId);
            return new Promise<Map<string, string[]>[]>((resolve, reject) => {
                this.finishedEmitter.on(requestId, () => {
                    this.isBusy = true;
                    this.extract(text, resolve);
                })
            });
        } else {
            this.isBusy = true;
            return new Promise<Map<string, string[]>[]>((resolve, reject) => {
                this.extract(text, resolve);
            });
        }
    }

    /**
     * Kills the Java process
     */
    public exit(): void {
        this.childProcess.kill();
    }
}