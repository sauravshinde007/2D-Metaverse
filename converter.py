import os

def create_codebase_dump(root_dir, output_file):
    """
    Traverses a directory tree and compiles all text-based files into a single text file.
    Specifically tuned for web development projects (MERN, etc.) by ignoring
    common heavy folders like node_modules.
    """
    
    # --- CONFIGURATION: EDIT THESE LISTS TO CUSTOMIZE BEHAVIOR ---
    
    # Folders to completely ignore (stops recursion into them)
    IGNORED_DIRS = {
        'node_modules', '.git', '.next', 'dist', 'build', 
        '__pycache__', 'venv', 'env', '.idea', '.vscode', 
        'coverage', 'tmp'
    }
    
    # Specific files to ignore
    IGNORED_FILES = {
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
        '.DS_Store', 'thumbs.db', output_file
    }
    
    # Extensions to explicitly skip (binary files, images, etc.)
    # Note: The script also attempts to detect binary content automatically,
    # but this list saves processing time.
    IGNORED_EXTENSIONS = {
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
        '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', 
        '.pyc', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm'
    }

    # -----------------------------------------------------------

    print(f"Starting scan of: {root_dir}")
    print(f"Outputting to: {output_file}")
    
    file_count = 0
    
    try:
        with open(output_file, 'w', encoding='utf-8') as out_f:
            # Write a header for the whole dump
            out_f.write(f"PROJECT CODEBASE DUMP\n")
            out_f.write(f"Source Directory: {os.path.abspath(root_dir)}\n")
            out_f.write("="*50 + "\n\n")

            for root, dirs, files in os.walk(root_dir):
                # 1. Modify 'dirs' in-place to prevent walking into ignored directories
                # This is more efficient than checking inside the loop
                dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, root_dir)
                    
                    # 2. Check explicit file ignores
                    if file in IGNORED_FILES:
                        continue
                        
                    # 3. Check extension ignores
                    _, ext = os.path.splitext(file)
                    if ext.lower() in IGNORED_EXTENSIONS:
                        continue
                    
                    # 4. Attempt to read and write content
                    try:
                        with open(file_path, 'r', encoding='utf-8') as in_f:
                            content = in_f.read()
                            
                            # Write File Header
                            out_f.write(f"\n{'='*20} START FILE: {relative_path} {'='*20}\n")
                            out_f.write(f"Path: {relative_path}\n")
                            out_f.write(f"{'-'*50}\n")
                            
                            # Write Content
                            out_f.write(content)
                            
                            # Write File Footer
                            out_f.write(f"\n{'='*20} END FILE: {relative_path} {'='*20}\n\n")
                            
                            file_count += 1
                            print(f"Processed: {relative_path}")

                    except UnicodeDecodeError:
                        # This catches files that passed the extension check but are actually binary
                        print(f"Skipped (Binary detected): {relative_path}")
                    except Exception as e:
                        print(f"Error reading {relative_path}: {e}")

        print(f"\nDone! Successfully processed {file_count} files.")
        print(f"Result saved to: {os.path.abspath(output_file)}")

    except Exception as e:
        print(f"Critical Error: {e}")

if __name__ == "__main__":
    # Settings
    # Use '.' for current directory, or specify a path like 'C:/Projects/MyMernApp'
    TARGET_DIRECTORY = "." 
    OUTPUT_FILENAME = "project_context.txt"
    
    create_codebase_dump(TARGET_DIRECTORY, OUTPUT_FILENAME)