#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Default configuration object for the file sync operation
 */
const DEFAULT_CONFIG = {
  fileListPath: '',
  sourceBranch: '',
  targetBranch: '',
  encoding: 'utf-8'
};

/**
 * Binary file extensions that should be processed as binary
 */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg',
  '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.exe', '.dll', '.so', '.dylib', '.bin'
]);

/**
 * Custom error class for Git-related operations
 */
class GitError extends Error {
  constructor(message, command) {
    super(message);
    this.name = 'GitError';
    this.command = command;
  }
}

/**
 * Custom error class for file system operations
 */
class FileSystemError extends Error {
  constructor(message, filePath) {
    super(message);
    this.name = 'FileSystemError';
    this.filePath = filePath;
  }
}

/**
 * Command line interface utilities
 */
class CLIHelper {
  /**
   * Parses command line arguments
   * @returns {Object} Parsed configuration
   */
  static parseArguments() {
    const args = process.argv.slice(2);
    const config = { ...DEFAULT_CONFIG };
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '-f':
        case '--file-list':
          if (!nextArg) {
            throw new Error('File list path is required after -f/--file-list');
          }
          config.fileListPath = nextArg;
          i++; // Skip next argument
          break;

        case '-s':
        case '--source':
          if (!nextArg) {
            throw new Error('Source branch is required after -s/--source');
          }
          config.sourceBranch = nextArg;
          i++; // Skip next argument
          break;

        case '-t':
        case '--target':
          if (!nextArg) {
            throw new Error('Target branch is required after -t/--target');
          }
          config.targetBranch = nextArg;
          i++; // Skip next argument
          break;

        case '-e':
        case '--encoding':
          if (!nextArg) {
            throw new Error('Encoding is required after -e/--encoding');
          }
          config.encoding = nextArg;
          i++; // Skip next argument
          break;

        case '-h':
        case '--help':
          this.showHelp();
          process.exit(0);
          break;

        case '-v':
        case '--version':
          this.showVersion();
          process.exit(0);
          break;

        default:
          if (arg.startsWith('-')) {
            throw new Error(`Unknown option: ${arg}. Use --help for usage information.`);
          }
          // If it doesn't start with -, treat it as a file list path if none is set
          if (config.fileListPath === DEFAULT_CONFIG.fileListPath) {
            config.fileListPath = arg;
          }
          break;
      }
    }

    return config;
  }

  /**
   * Displays help information
   */
  static showHelp() {
    console.log(`
Git File Synchronizer v0.0.1

USAGE:
  node git-helper.cjs [OPTIONS] [FILE_LIST]

OPTIONS:
  -f, --file-list <path>    Path to file list (default: files-to-pick.txt)
  -s, --source <branch>     Source branch name (default: uat_changes)
  -t, --target <branch>     Target branch name (default: develop_v4_test)
  -e, --encoding <encoding> File encoding (default: utf-8)
  -h, --help               Show this help message
  -v, --version            Show version information

EXAMPLES:
  # Use default configuration
  node git-helper.cjs

  # Specify custom branches
  node git-helper.cjs -s main -t feature-branch

  # Use custom file list
  node git-helper.cjs -f my-files.txt -s main -t develop

  # Full custom configuration
  node git-helper.cjs --file-list files.txt --source main --target develop --encoding utf-8

  # Positional file list argument
  node git-helper.cjs my-files.txt

DESCRIPTION:
  This script synchronizes specified files from a source Git branch to a target 
  branch. It reads a list of files from a text file, retrieves their content 
  from the source branch, and overwrites them in the current working directory 
  (which should be on the target branch).

  The file list supports:
  - Simple file paths (one per line)
  - Rich format with sections and comments
  - Bullet points (lines starting with -)
  - Comments (lines starting with #)
  - Inline comments in parentheses

FILE LIST FORMAT:
  # This is a comment
  Section 1
  - path/to/file1.js
  - path/to/file2.css

  Section 2  
  - another/file.json (optional comment)
  - image.png (this is a binary file)
  path/without/bullet.js
`);
  }

  /**
   * Displays version information
   */
  static showVersion() {
    console.log('Git File Synchronizer v0.0.1');
    console.log('A tool for synchronizing files between Git branches');
  }

  /**
   * Validates the configuration
   * @param {Object} config - Configuration to validate
   */
  static validateConfig(config) {
    if (!config.fileListPath) {
      throw new Error('File list path cannot be empty');
    }
    if (!config.sourceBranch) {
      throw new Error('Source branch cannot be empty');
    }
    if (!config.targetBranch) {
      throw new Error('Target branch cannot be empty');
    }
    if (config.sourceBranch === config.targetBranch) {
      throw new Error('Source and target branches cannot be the same');
    }
  }
}

/**
 * Utility class for Git operations
 */
class GitOperations {
  /**
   * Gets the current Git branch name
   * @returns {string} Current branch name
   * @throws {GitError} If unable to determine current branch
   */
  static getCurrentBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error) {
      throw new GitError('Failed to get current branch', 'git rev-parse --abbrev-ref HEAD');
    }
  }

  /**
   * Switches to the specified branch
   * @param {string} branch - Branch name to switch to
   * @throws {GitError} If checkout fails
   */
  static switchToBranch(branch) {
    try {
      console.log(`Switching to ${branch} branch...`);
      execSync(`git checkout ${branch}`, { stdio: 'inherit' });
    } catch (error) {
      throw new GitError(`Failed to checkout branch: ${branch}`, `git checkout ${branch}`);
    }
  }

  /**
   * Determines if a file should be treated as binary based on its extension
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if file should be treated as binary
   */
  static isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Gets file content from a specific branch
   * @param {string} branch - Source branch name
   * @param {string} filePath - Path to the file
   * @param {string} encoding - File encoding (ignored for binary files)
   * @returns {string|Buffer} File content
   * @throws {GitError} If file doesn't exist in the branch
   */
  static getFileFromBranch(branch, filePath, encoding = 'utf-8') {
    try {
      const isBinary = this.isBinaryFile(filePath);
      
      if (isBinary) {
        // For binary files, don't specify encoding to get Buffer
        return execSync(`git show ${branch}:${filePath}`, { 
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        // For text files, use specified encoding
        return execSync(`git show ${branch}:${filePath}`, { 
          encoding: encoding,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }
    } catch (error) {
      throw new GitError(`File "${filePath}" not found in branch "${branch}"`, `git show ${branch}:${filePath}`);
    }
  }

  /**
   * Stages specified files for commit
   * @param {string[]} files - Array of file paths to stage
   * @throws {GitError} If staging fails
   */
  static stageFiles(files) {
    if (files.length === 0) {
      console.log('No files to stage.');
      return;
    }

    try {
      // Use -- to separate files from git options for safety
      execSync(`git add -- ${files.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
      console.log(`✓ Staged ${files.length} file(s)`);
    } catch (error) {
      throw new GitError('Failed to stage files', 'git add');
    }
  }
}

/**
 * Utility class for file system operations
 */
class FileOperations {
  /**
   * Parses a rich file list format with sections, bullet points, and comments
   * @param {string} content - Raw content from the file list
   * @returns {Object} Parsed structure with sections, files, and comments
   */
  static parseRichFileList(content) {
    const lines = content.split('\n');
    const result = {
      sections: [],
      allFiles: [],
      fileComments: new Map(), // Map to store file -> comment mapping
      metadata: {}
    };

    let currentSection = null;
    let isInSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Skip comment lines (starting with #)
      if (trimmedLine.startsWith('#')) {
        continue;
      }

      // Check if this line is a file path (starts with - or has file extension)
      const isFilePath = trimmedLine.startsWith('-') || 
                        /\.(js|ts|jsx|tsx|svelte|vue|css|scss|sass|html|json|md|txt|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|otf|eot|pdf|zip)$/i.test(trimmedLine);

      if (isFilePath) {
        // Extract file path (remove leading -, whitespace)
        let processedLine = trimmedLine.replace(/^-\s*/, '').trim();
        
        // Extract inline comments in parentheses
        let filePath = processedLine;
        let comment = null;
        
        const commentMatch = processedLine.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
        if (commentMatch) {
          filePath = commentMatch[1].trim();
          comment = commentMatch[2].trim();
        }

        // Skip if no valid file path remains
        if (!filePath) {
          continue;
        }

        result.allFiles.push(filePath);
        
        // Store comment if found
        if (comment) {
          result.fileComments.set(filePath, comment);
        }

        if (currentSection) {
          currentSection.files.push(filePath);
          isInSection = true;
        }
      } else {
        // This might be a section header
        // Section headers are typically standalone lines that don't start with -
        if (isInSection || currentSection === null) {
          // Start a new section
          currentSection = {
            name: trimmedLine,
            files: []
          };
          result.sections.push(currentSection);
          isInSection = false;
        }
      }
    }

    return result;
  }

  /**
   * Reads and parses the file list from the specified path
   * Supports both simple and rich file list formats
   * @param {string} filePath - Path to the file list
   * @param {string} encoding - File encoding
   * @returns {Promise<Object>} Parsed file list with sections and metadata
   * @throws {FileSystemError} If file doesn't exist or can't be read
   */
  static async getFileList(filePath, encoding = 'utf-8') {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      const content = await fs.readFile(filePath, encoding);
      const parsed = this.parseRichFileList(content);

      if (parsed.allFiles.length === 0) {
        throw new FileSystemError('File list is empty or contains no valid file entries', filePath);
      }

      console.log(`✓ Found ${parsed.allFiles.length} file(s) in file list`);
      
      // Display sections if they exist
      if (parsed.sections.length > 0) {
        console.log(`✓ Organized into ${parsed.sections.length} section(s):`);
        parsed.sections.forEach(section => {
          if (section.files.length > 0) {
            console.log(`  • ${section.name}: ${section.files.length} file(s)`);
          }
        });
      }

      // Display comments if they exist
      if (parsed.fileComments.size > 0) {
        console.log(`✓ Found ${parsed.fileComments.size} file(s) with comments`);
      }

      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new FileSystemError(`File list "${filePath}" not found`, filePath);
      }
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError(`Failed to read file list: ${error.message}`, filePath);
    }
  }

  /**
   * Ensures the directory exists for a given file path
   * @param {string} filePath - Full path to the file
   */
  static async ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    
    try {
      await fs.access(dir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Writes content to a file, creating directories if necessary
   * @param {string} filePath - Path where to write the file
   * @param {string|Buffer} content - Content to write
   * @param {string} encoding - File encoding (ignored for Buffer content)
   * @throws {FileSystemError} If write operation fails
   */
  static async writeFile(filePath, content, encoding = 'utf-8') {
    try {
      await this.ensureDirectoryExists(filePath);
      
      if (Buffer.isBuffer(content)) {
        // Write binary content
        await fs.writeFile(filePath, content);
      } else {
        // Write text content with encoding
        await fs.writeFile(filePath, content, encoding);
      }
    } catch (error) {
      throw new FileSystemError(`Failed to write file: ${error.message}`, filePath);
    }
  }
}

/**
 * Main class that orchestrates the file synchronization process
 */
class FileSynchronizer {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      binaryFiles: 0,
      textFiles: 0,
      errors: [],
      sections: [],
      comments: [] // Store file comments for display
    };
    this.fileList = null;
  }

  /**
   * Displays current configuration
   */
  displayConfig() {
    console.log('Configuration:');
    console.log(`  File list: ${this.config.fileListPath}`);
    console.log(`  Source branch: ${this.config.sourceBranch}`);
    console.log(`  Target branch: ${this.config.targetBranch}`);
    console.log(`  Encoding: ${this.config.encoding}`);
    console.log('');
  }

  /**
   * Ensures we're on the correct target branch
   */
  async ensureCorrectBranch() {
    const currentBranch = GitOperations.getCurrentBranch();
    
    if (currentBranch !== this.config.targetBranch) {
      GitOperations.switchToBranch(this.config.targetBranch);
    } else {
      console.log(`✓ Already on ${this.config.targetBranch} branch`);
    }
  }

  /**
   * Overwrites a single file with content from the source branch
   * @param {string} filePath - Path to the file to overwrite
   * @param {string} sectionName - Name of the section this file belongs to
   */
  async overwriteFile(filePath, sectionName = null) {
    try {
      const isBinary = GitOperations.isBinaryFile(filePath);
      const fileType = isBinary ? '[BINARY]' : '[TEXT]';
      const displayPath = sectionName ? `[${sectionName}] ${filePath}` : filePath;
      
      console.log(`Syncing: ${fileType} ${displayPath}`);
      
      const content = GitOperations.getFileFromBranch(this.config.sourceBranch, filePath, this.config.encoding);
      await FileOperations.writeFile(filePath, content, this.config.encoding);
      
      this.stats.filesProcessed++;
      if (isBinary) {
        this.stats.binaryFiles++;
      } else {
        this.stats.textFiles++;
      }
      
      // Store comment for later display if it exists
      if (this.fileList && this.fileList.fileComments.has(filePath)) {
        this.stats.comments.push({
          file: filePath,
          comment: this.fileList.fileComments.get(filePath),
          section: sectionName
        });
      }
      
      console.log(`  ✓ ${filePath}`);
    } catch (error) {
      this.stats.filesSkipped++;
      this.stats.errors.push({ file: filePath, section: sectionName, error: error.message });
      
      if (error instanceof GitError) {
        console.error(`  ✗ ${filePath}: ${error.message}`);
      } else {
        console.error(`  ✗ ${filePath}: Unexpected error - ${error.message}`);
      }
    }
  }

  /**
   * Processes all files with section-aware logging
   * @param {Object} fileList - Parsed file list with sections
   */
  async overwriteFiles(fileList) {
    const totalFiles = fileList.allFiles.length;
    console.log(`\nSyncing ${totalFiles} file(s) from ${this.config.sourceBranch}...\n`);
    
    if (fileList.sections.length > 0) {
      // Process files by section for better organization
      for (const section of fileList.sections) {
        if (section.files.length > 0) {
          console.log(`\n📁 ${section.name} (${section.files.length} files):`);
          console.log('─'.repeat(50));
          
          for (const file of section.files) {
            await this.overwriteFile(file, section.name);
          }
          
          // Update section stats
          const sectionStats = {
            name: section.name,
            total: section.files.length,
            processed: section.files.filter(file => 
              !this.stats.errors.some(error => error.file === file)
            ).length,
            skipped: section.files.filter(file =>
              this.stats.errors.some(error => error.file === file)
            ).length
          };
          this.stats.sections.push(sectionStats);
        }
      }
    } else {
      // Process files without sections
      for (const file of fileList.allFiles) {
        await this.overwriteFile(file);
      }
    }
  }

  /**
   * Displays operation statistics with section breakdown
   */
  displayStats() {
    console.log('\n' + '='.repeat(60));
    console.log('SYNCHRONIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`  - Text files: ${this.stats.textFiles}`);
    console.log(`  - Binary files: ${this.stats.binaryFiles}`);
    console.log(`Files skipped: ${this.stats.filesSkipped}`);
    
    // Display section-wise statistics
    if (this.stats.sections.length > 0) {
      console.log('\nSection Summary:');
      console.log('─'.repeat(40));
      this.stats.sections.forEach(section => {
        const successRate = section.total > 0 ? 
          ((section.processed / section.total) * 100).toFixed(1) : '0.0';
        console.log(`  ${section.name}:`);
        console.log(`    ✓ ${section.processed}/${section.total} files (${successRate}%)`);
        if (section.skipped > 0) {
          console.log(`    ✗ ${section.skipped} skipped`);
        }
      });
    }
    
    // Display file comments
    if (this.stats.comments.length > 0) {
      console.log('\nFile Comments:');
      console.log('─'.repeat(40));
      this.stats.comments.forEach(({ file, comment, section }) => {
        const prefix = section ? `[${section}]` : '';
        console.log(`  ${prefix} ${file}: ${comment}`);
      });
    }
    
    if (this.stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      console.log('─'.repeat(40));
      this.stats.errors.forEach(({ file, section, error }) => {
        const prefix = section ? `[${section}]` : '';
        console.log(`  ${prefix} ${file}: ${error}`);
      });
    }
    
    const successRate = this.stats.filesProcessed + this.stats.filesSkipped > 0 ?
      ((this.stats.filesProcessed / (this.stats.filesProcessed + this.stats.filesSkipped)) * 100).toFixed(1) : '0.0';
    console.log(`\nOverall success rate: ${successRate}%`);
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('Starting file synchronization...');
      this.displayConfig();

      // Step 1: Ensure correct branch
      await this.ensureCorrectBranch();

      // Step 2: Get file list
      this.fileList = await FileOperations.getFileList(this.config.fileListPath, this.config.encoding);

      // Step 3: Overwrite files
      await this.overwriteFiles(this.fileList);

      // Step 4: Stage successfully processed files
      const successfulFiles = this.fileList.allFiles.filter(file => 
        !this.stats.errors.some(error => error.file === file)
      );
      
      // if (successfulFiles.length > 0) {
      //   GitOperations.stageFiles(successfulFiles);
      //   console.log('\n✓ Files staged and ready for commit');
      // }

      // Step 5: Display statistics
      this.displayStats();

      // Step 6: Exit with appropriate code
      if (this.stats.errors.length > 0) {
        console.log('\n⚠️  Some files could not be synchronized. Please review the errors above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All files synchronized successfully!');
      }

    } catch (error) {
      console.error('\n❌ Fatal error during synchronization:');
      console.error(error.message);
      
      if (error.command) {
        console.error(`Failed command: ${error.command}`);
      }
      
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  try {
    const config = CLIHelper.parseArguments();
    CLIHelper.validateConfig(config);
    
    const synchronizer = new FileSynchronizer(config);
    synchronizer.run().catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log('\nUse --help for usage information.');
    process.exit(1);
  }
}

module.exports = { FileSynchronizer, GitOperations, FileOperations, CLIHelper, DEFAULT_CONFIG };