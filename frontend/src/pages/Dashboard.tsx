import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useSignalR } from '../hooks/useSignalR';
import { Plus, Search, Trash2, CheckCircle2, Circle, ChevronLeft, ChevronRight, Hash, Paperclip, UploadCloud, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileAttachment {
  id: number;
  fileName: string;
  filePath: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  createdBy: number;
  files?: FileAttachment[];
}

const Dashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  
  // const fileInputRef = useRef<HTMLInputElement>(null);

  const { connection } = useSignalR('http://localhost:5000/taskhub');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/items`, {
        params: {
          search,
          status: statusFilter,
          page,
          pageSize: 9
        }
      });
      setTasks(response.data.items);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchTasks();
    }, 300);
    return () => clearTimeout(handler);
  }, [search, statusFilter, page]);

  useEffect(() => {
    if (!connection) return;

    connection.on('ReceiveTaskUpdate', (action: string, task: Task) => {
      if (action === 'Created') {
        if (page === 1) setTasks(prev => [task, ...prev].slice(0, 9));
      } else if (action === 'Updated') {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
      } else if (action === 'Deleted') {
        setTasks(prev => prev.filter(t => t.id !== task.id));
      }
    });

    connection.on('ReceiveFileUpdate', (action: string, file: any) => {
      if (action === 'Uploaded') {
        setTasks(prev => prev.map(t => t.id === file.itemId ? { ...t, files: [...(t.files || []), file] } : t));
      } else if (action === 'Deleted') {
        setTasks(prev => prev.map(t => ({ ...t, files: t.files?.filter(f => f.id !== file.id) })));
      }
    });

    return () => {
      connection.off('ReceiveTaskUpdate');
      connection.off('ReceiveFileUpdate');
    };
  }, [connection, page]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/items', { title: newTaskTitle, description: newTaskDesc });
      setNewTaskTitle('');
      setNewTaskDesc('');
      (document.getElementById('add_task_modal') as any).close();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await api.put(`/items/${task.id}`, { ...task, status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await api.delete(`/items/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (taskId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingId(taskId);
    try {
      await api.post(`/items/${taskId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (err) {
      alert('File upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await api.delete(`/files/${fileId}`);
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Workspace</h1>
          <p className="opacity-60 font-medium">Manage and collaborate on shared tasks in real-time.</p>
        </div>
        <button 
          className="btn btn-primary px-8 shadow-lg shadow-primary/20"
          onClick={() => (document.getElementById('add_task_modal') as any).showModal()}
        >
          <Plus size={20} />
          New Task
        </button>
      </section>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-base-200/50 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
          <input
            type="text"
            placeholder="Search by title or description..."
            className="input input-bordered w-full pl-12 bg-base-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            className="select select-bordered bg-base-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
          <div className="divider divider-horizontal hidden sm:flex"></div>
          <div className="join">
            <button className="btn btn-bordered join-item" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn btn-bordered join-item no-animation">Page {page} of {totalPages}</button>
            <button className="btn btn-bordered join-item" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-dots loading-lg text-primary"></span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode='popLayout'>
            {tasks.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`card bg-base-100 shadow-xl border border-white/5 hover:border-primary/30 transition-all duration-300 group ${task.status === 'Completed' ? 'opacity-70' : ''}`}
              >
                <div className="card-body p-6 gap-4">
                  <div className="flex justify-between items-start">
                    <div className={`badge badge-sm font-bold tracking-widest uppercase py-2 px-3 ${
                      task.status === 'Completed' ? 'badge-success' : 'badge-primary'
                    }`}>
                      {task.status || 'Pending'}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="btn btn-ghost btn-xs btn-circle" onClick={() => handleToggleStatus(task)}>
                        {task.status === 'Completed' ? <Circle size={16} /> : <CheckCircle2 size={16} />}
                      </button>
                      <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => handleDeleteTask(task.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className={`text-xl font-bold mb-1 ${task.status === 'Completed' ? 'line-through opacity-50' : ''}`}>
                      {task.title}
                    </h3>
                    <p className="text-sm opacity-60 line-clamp-2 leading-relaxed h-10 mb-4">
                      {task.description || 'No additional details provided.'}
                    </p>
                  </div>

                  {/* Files Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                      <span>Attachments</span>
                      <label className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
                        <UploadCloud size={12} />
                        Upload
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(task.id, e)} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                      {uploadingId === task.id && <span className="loading loading-spinner loading-xs"></span>}
                      {task.files?.map(file => (
                        <div key={file.id} className="badge badge-ghost gap-1 pr-0 hover:bg-base-200 transition-colors py-3 px-3">
                          <Paperclip size={10} />
                          <span className="text-[10px] max-w-[80px] truncate">{file.fileName}</span>
                          <button onClick={() => handleDeleteFile(file.id)} className="btn btn-ghost btn-xs px-1 text-error hover:bg-error/10">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {(!task.files || task.files.length === 0) && uploadingId !== task.id && (
                        <span className="text-[10px] italic opacity-30">No files attached</span>
                      )}
                    </div>
                  </div>

                  <div className="card-actions justify-between items-center mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                       <div className="avatar placeholder">
                        <div className="bg-neutral text-neutral-content rounded-full w-6">
                          <span className="text-[10px] font-bold">{task.createdBy}</span>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">User ID</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-40">
                      <Hash size={12} />
                      <span className="text-[10px] font-bold">{task.id}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {tasks.length === 0 && (
            <div className="col-span-full card bg-base-100 border-2 border-dashed border-white/10 p-20 text-center">
              <div className="opacity-20 flex flex-col items-center gap-4">
                <Search size={64} />
                <p className="text-xl font-bold">No tasks found</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <dialog id="add_task_modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box p-8 border border-white/10">
          <h3 className="font-bold text-3xl brand mb-6">Create New Task</h3>
          <form onSubmit={handleCreateTask} className="space-y-6">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold opacity-60 uppercase tracking-widest text-[10px]">Title</span></label>
              <input 
                type="text" 
                placeholder="Fix the navigation bugs..." 
                className="input input-bordered w-full bg-base-200" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold opacity-60 uppercase tracking-widest text-[10px]">Description</span></label>
              <textarea 
                className="textarea textarea-bordered h-32 bg-base-200" 
                placeholder="Details about this task..."
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
              ></textarea>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => (document.getElementById('add_task_modal') as any).close()}>Cancel</button>
              <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20">Create Task</button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default Dashboard;
