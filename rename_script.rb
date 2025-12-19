
require 'find'

MAPPINGS = {
  'Agents' => 'Agents',
  'Agent' => 'Agent',
  'agents' => 'agents',
  'agent' => 'agent',
  'agent_id' => 'agent_id'
}

EXCLUDED_DIRS = %w[.git node_modules dist build .idea]
EXCLUDED_EXTENSIONS = %w[.png .jpg .ico .lock]

def process_file(path)
  begin
    file_content = File.read(path, encoding: 'UTF-8')
  rescue
    puts "Skipping binary/non-UTF8 file: #{path}"
    return
  end

  original_content = file_content.dup
  modified = false

  MAPPINGS.each do |target, replacement|
    if file_content.include?(target)
      file_content.gsub!(target, replacement)
      modified = true
    end
  end

  if modified
    File.write(path, file_content)
    puts "Updated: #{path}"
  end
end

Find.find('.') do |path|
  if File.directory?(path)
    if EXCLUDED_DIRS.any? { |dir| path.include?("/#{dir}") || path == "./#{dir}" }
      Find.prune
    end
    next
  end

  next if EXCLUDED_EXTENSIONS.include?(File.extname(path))
  
  process_file(path)
end
