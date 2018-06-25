const fs = require ('fs');
const diff = require ('diff');
const path = require('path');
const _ = require('lodash');

class M {

    static SUCCESS () {
        return {
            S_REPO_SUCCESSFULLY_INITIALIZED: 'S_REPO_SUCCESSFULLY_INITIALIZED',
            S_COMMIT_SUCCESSFULLY_CREATED: 'S_COMMIT_SUCCESSFULLY_CREATED',
            S_SUCCESSFULLY_REVERTED: 'S_SUCCESSFULLY_REVERTED',
            S_SUCCESSFULLY_EXECUTED: 'S_SUCCESSFULLY_EXECUTED',
        }
    }

    static ARGUMNETS () {
        return {
            M_COMMIT_MESSAGE: '-m',
            M_COMMAND_TO_RUN: 'make',
            M_INDEX: '-i'
        }
    }

    static COMMANDS () {
        return {
            init: 'INIT_REPO',
            INIT: 'INIT_REPO',
            commit: 'COMMIT',
            COMMIT: 'COMMIT',
            revert: 'REVERT',
            REVERT: 'REVERT'
        }
    };

    static ERRORS () {
        return {
            E_LOCAL_REPO_ALREADY_EXISTS: 'E_LOCAL_REPO_ALREADY_EXISTS',
            E_LOCAL_BRANCH_ALREADY_EXISTS: 'E_LOCAL_BRANCH_ALREADY_EXISTS',
            E_COMMAND_NOT_FOUND: 'E_COMMAND_NOT_FOUND',
            E_COMMAND_NOT_EXISTS: 'E_COMMAND_NOT_EXISTS',
            E_CONTENT_IDENTICAL: 'E_CONTENT_IDENTICAL',
            E_NOTHING_TO_COMMIT: 'E_NOTHING_TO_COMMIT'
        }
    }

    constructor () {
        this.options = {
            commandToRun: false,
            argumensToCommand: {},
            branchNameToCreate: '',
            runIn: '',
            workingDirecotoryName: '.m',
            diffFileName: 'diff.json',
            workingDirectoryPath: '',
            outputMsgDefault: 'success',
            errorMsgDefault: 'error',
            branch: {
                masterName: 'master',
                currentName: ''
            },
            commit: {
              head: 1
            },
            metadataFileName: 'metadata.json'
        };
        this.setFolder ();
        this.options.workingDirectoryPath = `${this.options.runIn}/${this.options.workingDirecotoryName}`;
        const metadata = this.getMetadata ();
        this.options = Object.assign (this.options, metadata);
    }

    setFolder (folder = '') {
        this.options.runIn = folder || process.cwd();
    }

    isError (code) {
        throw M.ERRORS()[code] || MRunner.ERRORS()[code] ||  this.options.errorMsgDefault;
    }

    show (...args) {
        const defaultOptions = {};
        const lastParam = args[args.length - 1];
        const withOptions = lastParam instanceof Object;
        const options = Object.assign(defaultOptions, (withOptions ? lastParam : {}));
        if (withOptions) args.pop();
        console.log(...args);
    }

    scan (dir) {
        function readDirR(d) {
            return fs.statSync(d).isDirectory()
                ? Array.prototype.concat(...fs.readdirSync(d).map(f => readDirR(path.join(d, f))))
                : d;
        }
        return readDirR(dir).map(item => item.replace(this.options.runIn, ''));
    }

    valiateWorkingDirectory () {

    }

    setHead () {
        const branchName = this.options.branch.currentName;
        const pathToBranchName = `${this.options.workingDirectoryPath}/${branchName}`;
        const commits = fs.readdirSync(pathToBranchName);
        const head = parseInt(commits.pop()) || 0;
        this.options.commit.head = head;
    }

    createFoldeForNextCommit () {
        const branchName = this.options.branch.currentName;
        const pathToBranchName = `${this.options.workingDirectoryPath}/${branchName}`;
        let head = this.options.commit.head;
        head++;
        fs.mkdirSync (`${pathToBranchName}/${head}`);
    }

    scanFiles () {
        return this.scan(this.options.runIn);
    }

    getFileHistoryToCommitId (id = 0, filename = '') {
        const branchName = this.options.branch.currentName;
        const pathToBranchName = `${this.options.workingDirectoryPath}/${branchName}`;
        const commits = fs.readdirSync (pathToBranchName);
        const history = [];
        id = parseInt(id);
        commits.map(commit => {
            commit = parseInt(commit);
            if (commit && commit > id ) return ;
            try {
                const diff = require (`${pathToBranchName}/${commit}/${filename}#${this.options.diffFileName}`);
                const diffHistory = diff.history;
                history.push(diffHistory);
            } catch (e) {}
        });
        return history;
    }

    createFileByHistory (history = []) {

        if (!history.length) return '';

        let cursor = 0, string = '';
        function replaceAt (str, substr, from, to) {
            //FTw - NEED TO UPDATE IN FUTURE
            return str.substr(0, from) + substr+ str.substr(to ? to : from, str.length);
        }

        history.forEach(item => {
            cursor = 0;
            item.forEach(rule => {
                const substr = rule.value || '';
                if (rule.removed) string = replaceAt(string, '', cursor, (cursor + substr.length));
                if (rule.added) string = replaceAt(string, substr, cursor);
                if (!rule.removed) cursor += rule.count;
            });
        });
        return string;
    }

    getFilesDiff (prev, current) {
        return diff.diffChars(prev, current);
    }

    eachFile (files = [], callback) {
        for (let file of files) {
            if (file.indexOf(`/${this.options.workingDirecotoryName}/`) === 0) continue ;
            callback(file);
        }
    }


    makeRevert () {
        this.setHead();
        const args = M.ARGUMNETS();
        const headToRevertIndex = this.options.argumensToCommand[args.M_INDEX];
        const files = this.scanFiles();

        for (let file of files) {
            if (file.indexOf(`/${this.options.workingDirecotoryName}/`) === 0) continue ;
            const temporaryName = file.replace(/\//g, '-');
            const fileHistory = this.getFileHistoryToCommitId(headToRevertIndex, temporaryName);
            const prevVersionOfFile = this.createFileByHistory(fileHistory);
            fs.writeFileSync(this.options.runIn + file, prevVersionOfFile, 'utf-8');
        }

        this.makeCommit();
    }

    makeCommit () {
        this.setHead();
        const files = this.scanFiles();
        const args = M.ARGUMNETS();
        const toInsertInDiff = [];

        for (let file of files) {
            //TO-DO Exclude the working directory from index. May be should to same implementate like .gitignore
            if (file.indexOf(`/${this.options.workingDirecotoryName}/`) === 0) continue ;

            const temporaryName = file.replace(/\//g, '-');
            const fileHistory = this.getFileHistoryToCommitId(this.options.commit.head, temporaryName);

            const prevVersionOfFile = this.createFileByHistory(fileHistory);
            const currentVerionOfFile = fs.readFileSync(`${this.options.runIn}${file}`, 'utf-8').toString();
            let difference = this.getFilesDiff (prevVersionOfFile, currentVerionOfFile);
            let commit = this.options.commit.head;
            commit++;
            if (difference.length == 1 &&  commit != 1 && !(difference[0].removed || difference[0].added)) continue ;

            if (commit != 1)
                difference = difference.map(diff => (!diff.removed && !diff.added) ? ({ count: diff.count, value: false }) : diff);

            const pathToBranchName = `${this.options.workingDirectoryPath}/${this.options.branch.currentName}`;
            const fileNameInsertDiff = `${pathToBranchName}/${commit}/${temporaryName}#${this.options.diffFileName}`;
            // TO-DO Here also can be store commid id, md5 sum of commit;
            toInsertInDiff.push({
                history: difference,
                realFileName: file,
                message: this.options.argumensToCommand[args.M_COMMAND_TO_RUN],
                filename: fileNameInsertDiff
            });

        }

        if (!toInsertInDiff.length) this.isError(M.ERRORS().E_CONTENT_IDENTICAL);
        this.createFoldeForNextCommit();
        for (let item of toInsertInDiff) fs.writeFileSync(item.filename, JSON.stringify(item));

        return {
            message: `Was updated and commited ${toInsertInDiff.length} files. (${toInsertInDiff.map(item => item.realFileName).join(', ')})`
        }
    }

    createBranch () {
        const branchName = this.options.branchNameToCreate;
        const pathToBranchName = `${this.options.workingDirectoryPath}/${branchName}`;
        if (fs.existsSync (pathToBranchName)) this.isError (M.ERRORS ().E_LOCAL_BRANCH_ALREADY_EXISTS);
        fs.mkdirSync (pathToBranchName);
        this.options.branch.currentName = branchName;
    }

    getMetadata () {
        const pathToMetadata = `${this.options.workingDirectoryPath}/${this.options.metadataFileName}`;
        if (!fs.existsSync(pathToMetadata)) return {};
        return require (`${this.options.workingDirectoryPath}/${this.options.metadataFileName}`);
    }

    updateMetadata (some = {}) {
        let metadata = this.getMetadata ();
        metadata.branch = this.options.branch;
        metadata = Object.assign (metadata, some);
        fs.writeFileSync (`${this.options.workingDirectoryPath}/${this.options.metadataFileName}`, JSON.stringify (metadata));
    }

    getCommitsList () {

    }

    getLog () {

    }

    _COMMIT (...args) {
        const data = this.makeCommit();
        return { code: 'S_COMMIT_SUCCESSFULLY_CREATED', data: data };
    }

    _REVERT (...args) {
        const data = this.makeRevert();
        return { code: 'S_SUCCESSFULLY_REVERTED', data: '' };
    }

    _LOG (...args) {
        const data = this.getLog();
        return { code: 'S_SUCCESSFULLY_REVERTED', data: data };
    }

    _INIT_REPO () {
        const workingDirectoryPath = `${this.options.runIn}/${this.options.workingDirecotoryName}`;
        if (fs.existsSync (workingDirectoryPath)) this.isError (M.ERRORS ().E_LOCAL_REPO_ALREADY_EXISTS);
        fs.mkdirSync (workingDirectoryPath);
        fs.writeFileSync (`${workingDirectoryPath}/${this.options.metadataFileName}`, '{}');
        this.options.branchNameToCreate = this.options.branch.masterName;
        this.createBranch ();
        this.makeCommit ();
        this.updateMetadata ();
        // console.log(diff.diffChars('bla bla', 'bla ster la'))
        return { code: 'S_REPO_SUCCESSFULLY_INITIALIZED', data: '' };
    }
}

class MRunner extends M {

    constructor () {
        super();

        this.setArgs();

        try {
            this.validate();
        } catch (e) {
            return this.show(e);
        }

        this.setCommand();

        try {
            this.execNativeCommand();
        } catch (e) {
            return this.show(e);
        }
    }

    execNativeCommand () {
        const {code, data} = this[`_${this.options.commandToRun}`](this.options.argumensToCommand);
        return this.show(M.SUCCESS()[code] || this.options.outputMsgDefault, data, {});
    }

    validate () {
        const commands = M.COMMANDS();
        const args = M.ARGUMNETS();
        const errors = M.ERRORS();

        const commandToRun = this.options.argumensToCommand[args.M_COMMAND_TO_RUN];
        if (!commandToRun) return this.isError(errors.E_COMMAND_NOT_FOUND);

        const commandExists = commands[commandToRun];
        if (!commandExists) return this.isError(errors.E_COMMAND_NOT_EXISTS);
    }

    setCommand () {
        this.options.commandToRun = M.COMMANDS()[this.options.argumensToCommand[M.ARGUMNETS().M_COMMAND_TO_RUN]];
    }

    setArgs () {
        process.argv.reduce((prev, current) => prev.split
            ? this.options.argumensToCommand[prev] = current.trim()
            : current
        );
    }

}

new MRunner ();