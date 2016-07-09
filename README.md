# Stanford Named Entity Recognizer (NER) wrapper for Node.js

This project is a simple wrapper around the [Stanford NER Library](http://nlp.stanford.edu/software/CRF-NER.shtml)

This project is written in [TypeScript Version 1.8.10](https://www.typescriptlang.org/)

It is highly recommended that you use [Visual Studio Code](https://code.visualstudio.com/) because then you will get code completion and other 
goodies when you use this library from TypeScript.

# Installation

This library spawns a Java process so your system needs to have [Java](https://java.com/en/download/).

With Java installed, you should also have Java as part of your path:

```
$ java -version
java version "1.8.0_91"
Java(TM) SE Runtime Environment (build 1.8.0_91-b14)
Java HotSpot(TM) 64-Bit Server VM (build 25.91-b14, mixed mode)
```

The version of Java is important otherwise this may not work

Naturally, you need [Node.js](https://nodejs.org/en/) as well.

```
$ node -v
v4.4.7
```

It is highly recommended that you install TypeScript as well, though you can use this library from pure Javascript as well.
```
$ npm install typescript -g
$ tsc -v
Version 1.8.10
```

Also you need to install the [typings](https://github.com/typings/typings) tool
```
npm install typings -g
```

## Updating the Stanford NER library

For the sake of simplicity, I have bundled **stanford-ner-2015-12-09**, but you can use a later version by specifying the (absolute) path in the options.

# Sample project setup (TypeScript)
```
$ mkdir ner-sample
$ cd ner-sample
$ npm init
$ typings init
$ tsc --init
$ npm install stanford-ner --save
$ typings install dt~node --global --save
```

Edit `tsconfig.js` to target `es6` instead of `es5`
```
{
    "compilerOptions": {
        "target": "es6",
        "declaration": true,
        "module": "commonjs",
        "sourceMap": true,
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "noImplicitAny": true
    },
    "exclude": [
        "node_modules"
    ]
}
``` 

Open the folder in VSCode and create a file called `index.ts`
```
import * as Stanford from "stanford-ner";

const ner = new Stanford.NER();

//Use with promises
function promises() {
    ner.getEntities("This is an awesome library by Stanford folks")
    .then((val) => {
        console.log(val);
        console.log("------------------");
    });

    ner.getEntities("The fate of Lehman Brothers, the beleaguered investment bank, hung in the balance on Sunday as Federal Reserve officials and the leaders of major financial institutions continued to gather in emergency meetings trying to complete a plan to rescue the stricken bank.  Several possible plans emerged from the talks, held at the Federal Reserve Bank of New York and led by Timothy R. Geithner, the president of the New York Fed, and Treasury Secretary Henry M. Paulson Jr.")
    .then((val) => {
        console.log(val);
        console.log("------------------");
    });
}


//Or use the async/await pattern
async function awaits() {
    const firstResult = await ner.getEntities("The rain in Spain falls mainly in the plains.");
    console.log(firstResult);
    console.log("------------------");
    
    const secondResult = await ner.getEntities("Humpty Dumpty sat on a wall.");
    console.log(secondResult);
    console.log("------------------");
}

async function main() {
    console.log("Calling promises...");
    promises();
    console.log("Calling awaits...");
    
    await awaits();
    console.log("We are done");
    ner.exit();
}

main();
```

Then compile by running `tsc`
```
$ tsc
```

This transpiles the TypeScript code to ES6 Javascript. So, next run the JavaScript file generated:
```
$ node index.js
```

This will output:
```
Calling promises...
Calling awaits...
[ Map { 'ORGANIZATION' => [ 'Stanford' ] } ]
------------------
[ Map { 'ORGANIZATION' => [ 'Lehman Brothers', 'Federal Reserve' ] },
  Map {
    'ORGANIZATION' => [ 'Federal Reserve Bank of New York',
    'New York Fed',
    'Treasury' ],
    'PERSON' => [ 'Timothy R. Geithner', 'Henry M. Paulson Jr.' ] } ]
------------------
[ Map { 'LOCATION' => [ 'Spain' ] } ]
------------------
[ Map { 'PERSON' => [ 'Humpty Dumpty' ] } ]
------------------
We are done
```

# License

As I mentioned before, this code is simply a wrapper for the Stanford NER library. I have no affiliation to Stanford and this library was developed mainly as a fun weekend project to understand child processes and also 
to refresh some knowledge about NLP. This code is distributed under the same license as the Stanford NER library.

```
stanford-ner is a Node.js wrapper around the Java based Stanford NER library
Copyright (C) 2016  Varun Chatterji

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
```
