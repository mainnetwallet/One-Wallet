        // Central Contract Storage - ALL sections use this
        function getCentralContracts() {
            const centralContracts  = JSON.parse(localStorage.getItem('centralContracts')  || '[]');
            const withdrawContracts = JSON.parse(localStorage.getItem('withdrawContracts') || '[]');
            
            // Combine and deduplicate by address + chainId
            const allContracts = [...centralContracts, ...withdrawContracts];
            const seen = new Set();
            const uniqueContracts = allContracts.filter(c => {
                const key = (c.address || '').toLowerCase() + '_' + (parseInt(c.chainId || 0, 10));
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            
            return uniqueContracts;
        }
        
        function saveCentralContracts(contracts) {
            localStorage.setItem('centralContracts', JSON.stringify(contracts));
        }
        
        function addToCentralContracts(contractData) {
            // Duplicate check by address + chainId (same address on different chains = different contract)
            const _cid = parseInt(contractData.chainId || 0, 10);
            let centralContracts = JSON.parse(localStorage.getItem('centralContracts') || '[]');
            const exists = centralContracts.some(c => {
                const sameCid = parseInt(c.chainId || 0, 10) === _cid;
                return c.address.toLowerCase() === contractData.address.toLowerCase() && sameCid;
            });
            if (!exists) {
                centralContracts.push(contractData);
                localStorage.setItem('centralContracts', JSON.stringify(centralContracts));
            }
        }
        
        // ── Premium delete modal state ──
        let _wdDeleteMode = null; // 'single' | 'all'
        let _wdDeleteAddress = null;
        let _wdDeleteStep1Done = false;

        function _wdDeleteDoExecute() {
            if (_wdDeleteMode === 'single') {
                const address = _wdDeleteAddress;
                let centralContracts = JSON.parse(localStorage.getItem('centralContracts') || '[]');
                centralContracts = centralContracts.filter(c => c.address.toLowerCase() !== address.toLowerCase());
                localStorage.setItem('centralContracts', JSON.stringify(centralContracts));
                let withdrawContracts = JSON.parse(localStorage.getItem('withdrawContracts') || '[]');
                withdrawContracts = withdrawContracts.filter(c => c.address.toLowerCase() !== address.toLowerCase());
                localStorage.setItem('withdrawContracts', JSON.stringify(withdrawContracts));
                ['savedContractsMultiKeyNative','savedContractsMultiKeyToken','savedContractsBatchNative','savedContractsBatchToken','batchTransferContracts','batchTransferContractsToken'].forEach(k => {
                    let arr = JSON.parse(localStorage.getItem(k) || '[]');
                    arr = arr.filter(c => c.address.toLowerCase() !== address.toLowerCase());
                    localStorage.setItem(k, JSON.stringify(arr));
                });
            } else {
                const allContracts = getCentralContracts();
                localStorage.setItem('centralContracts', '[]');
                localStorage.setItem('withdrawContracts', '[]');
                ['batchTransferContracts','batchTransferContractsToken','savedContractsMultiKeyNative','savedContractsMultiKeyToken','savedContractsBatchNative','savedContractsBatchToken'].forEach(k => localStorage.setItem(k, '[]'));
            }
            loadAllContracts();
        }

        function _wdShowDeleteModal(mode, address, contractCount) {
            _wdDeleteMode = mode;
            _wdDeleteAddress = address || null;
            _wdDeleteStep1Done = false;
            const modal = document.getElementById('wdDeleteModal');
            const box   = document.getElementById('wdDeleteModalBox');
            const icon  = document.getElementById('wdDeleteIcon');
            const title = document.getElementById('wdDeleteTitle');
            const sub   = document.getElementById('wdDeleteSub');
            const info  = document.getElementById('wdDeleteInfoContent');
            const btn   = document.getElementById('wdDeleteConfirmBtn');
            const dot2  = document.getElementById('wdStep2Dot');
            const lbl2  = document.getElementById('wdStepLabel2');
            const line  = document.getElementById('wdStepLineInner');
            const dot1  = document.getElementById('wdStep1Dot');
            const lbl1  = document.getElementById('wdStepLabel1');

            // Reset to step 1
            icon.textContent = mode === 'all' ? '🗑️' : '⚠️';
            icon.style.background = 'rgba(244,63,94,0.12)';
            icon.style.borderColor = 'rgba(244,63,94,0.3)';
            title.textContent = mode === 'all' ? `Delete All ${contractCount} Contract(s)?` : 'Delete Contract?';
            sub.textContent = mode === 'all'
                ? 'This will permanently remove all contracts from every section.'
                : `${address ? address.slice(0,6)+'...'+address.slice(-4) : ''} will be removed from all sections.`;
            info.innerHTML = mode === 'all'
                ? `<b style="color:#fca5a5;">Affected sections:</b><br>• Withdraw Manager<br>• Multi Key Native &amp; Token<br>• Batch Transfer Native &amp; Token<br>• All manually added contracts`
                : `<b style="color:#fca5a5;">⚠️ WARNING:</b> This contract will be permanently deleted from Withdraw Manager and all other sections. This action cannot be undone.`;
            btn.textContent = 'Delete';
            btn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
            btn.disabled = false;
            dot1.style.background = '#6366f1'; dot1.style.transform = 'scale(1.4)';
            dot2.style.background = 'rgba(255,255,255,0.15)'; dot2.style.transform = 'scale(1)';
            lbl1.style.color = '#6366f1'; lbl2.style.color = 'rgba(255,255,255,0.2)';
            line.style.width = '0%';

            modal.style.display = 'flex';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                box.style.opacity = '1';
                box.style.transform = 'scale(1) translateY(0)';
            }));
        }

        function wdDeleteCancel() {
            const modal = document.getElementById('wdDeleteModal');
            const box   = document.getElementById('wdDeleteModalBox');
            box.style.opacity = '0';
            box.style.transform = 'scale(0.88) translateY(20px)';
            setTimeout(() => { modal.style.display = 'none'; }, 280);
            _wdDeleteMode = null; _wdDeleteAddress = null; _wdDeleteStep1Done = false;
        }

        function wdDeleteStep() {
            const icon  = document.getElementById('wdDeleteIcon');
            const title = document.getElementById('wdDeleteTitle');
            const sub   = document.getElementById('wdDeleteSub');
            const info  = document.getElementById('wdDeleteInfoContent');
            const btn   = document.getElementById('wdDeleteConfirmBtn');
            const dot2  = document.getElementById('wdStep2Dot');
            const lbl2  = document.getElementById('wdStepLabel2');
            const dot1  = document.getElementById('wdStep1Dot');
            const line  = document.getElementById('wdStepLineInner');
            const box   = document.getElementById('wdDeleteModalBox');

            if (!_wdDeleteStep1Done) {
                // Step 1 → advance to step 2
                _wdDeleteStep1Done = true;
                // Animate step indicator
                dot1.style.background = '#10b981'; dot1.style.transform = 'scale(1)';
                dot2.style.background = '#f43f5e'; dot2.style.transform = 'scale(1.4)';
                lbl2.style.color = '#f43f5e'; line.style.width = '100%';
                // Shake the box
                box.style.animation = 'wdShake 0.4s ease';
                setTimeout(() => { box.style.animation = ''; }, 450);
                // Update content
                icon.textContent = '🚨';
                icon.style.background = 'rgba(244,63,94,0.2)';
                icon.style.borderColor = 'rgba(244,63,94,0.6)';
                title.textContent = 'Final Confirmation';
                sub.textContent = 'This is your LAST chance. Are you absolutely sure?';
                info.innerHTML = '<b style="color:#fca5a5;">🚨 CANNOT BE UNDONE</b><br>All selected contract data will be permanently erased from local storage.';
                btn.textContent = '⚠️ Yes, Delete Permanently';
                btn.style.background = 'linear-gradient(135deg,#dc2626,#7f1d1d)';
            } else {
                // Step 2 → execute
                btn.disabled = true;
                btn.textContent = 'Deleting...';
                icon.textContent = '✅';
                icon.style.background = 'rgba(16,185,129,0.15)';
                icon.style.borderColor = 'rgba(16,185,129,0.4)';
                icon.style.animation = 'wdSuccessPop 0.4s ease forwards';
                title.textContent = 'Deleted!';
                sub.textContent = 'Contracts have been permanently removed.';
                info.innerHTML = '<span style="color:#6ee7b7;">✅ Successfully deleted from all sections.</span>';
                _wdDeleteDoExecute();
                setTimeout(() => wdDeleteCancel(), 1200);
            }
        }

        function deleteFromWithdrawManager(address) {
            _wdShowDeleteModal('single', address, 1);
        }
        
        function clearAllContractsWithdraw() {
            const allContracts = getCentralContracts();
            if (allContracts.length === 0) {
                // Show inline log instead of alert
                return;
            }
            _wdShowDeleteModal('all', null, allContracts.length);
        }
        
        function deleteFromOtherSection(address, currentSection) {
            // This deletes from a specific section but keeps in Withdraw Manager
            const sectionNames = {
                'native': 'savedContractsMultiKeyNative',
                'token': 'savedContractsMultiKeyToken'
            };
            
            const storageKey = sectionNames[currentSection];
            if (!storageKey) return;
            
            let sectionContracts = JSON.parse(localStorage.getItem(storageKey) || '[]');
            sectionContracts = sectionContracts.filter(c => c.address.toLowerCase() !== address.toLowerCase());
            localStorage.setItem(storageKey, JSON.stringify(sectionContracts));
            
                        loadAllContracts(); // Reload
        }
        
